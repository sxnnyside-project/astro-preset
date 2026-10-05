import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { sxnnysideHeaders } from '../headers';

export interface ScaffoldOptions {
  /** kebab-case repository and package name, e.g. `docs-website`. */
  name: string;
  /** Production origin, e.g. `https://docs.sxnnysideproject.com`. */
  origin: string;
  /** Locale codes; the first one is the default. */
  locales: readonly string[];
  /** GitHub owner of the repo, e.g. `sxnnyside-project`. */
  org: string;
  /** Display name of the owner, e.g. `Sxnnyside Project`. */
  orgName: string;
  /** How the site depends on the preset: the release asset URL (see `defaultPresetSpec`) or `file:…`. */
  presetSpec: string;
}

const LOCALE_TAGS: Readonly<Record<string, string>> = { es: 'es-MX', en: 'en-US' };

const tagOf = (locale: string) => LOCALE_TAGS[locale] ?? locale;
const title = (name: string) =>
  name
    .replace(/-website$/, '')
    .split('-')
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(' ');
const WIDTH = 100;

/** JSON as Biome formats it: objects expanded, arrays of scalars on one line when they fit. */
function pretty(value: unknown): string {
  const render = (v: unknown, indent: string, prefixLength: number): string => {
    if (Array.isArray(v)) {
      const inline = `[${v.map((x) => JSON.stringify(x)).join(', ')}]`;
      const scalars = v.every((x) => x === null || typeof x !== 'object');
      if (v.length === 0 || (scalars && indent.length + prefixLength + inline.length <= WIDTH))
        return inline;
      const inner = `${indent}  `;
      return `[\n${v.map((x) => `${inner}${render(x, inner, 0)}`).join(',\n')}\n${indent}]`;
    }
    if (v !== null && typeof v === 'object') {
      const entries = Object.entries(v as Record<string, unknown>);
      if (entries.length === 0) return '{}';
      const inner = `${indent}  `;
      const body = entries.map(
        ([k, x]) =>
          `${inner}${JSON.stringify(k)}: ${render(x, inner, JSON.stringify(k).length + 2)}`,
      );
      return `{\n${body.join(',\n')}\n${indent}}`;
    }
    return JSON.stringify(v);
  };
  return `${render(value, '', 0)}\n`;
}

function packageRoot(): string {
  let dir = import.meta.dir;
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, 'package.json')) && existsSync(join(dir, 'templates'))) return dir;
    dir = dirname(dir);
  }
  throw new Error('cannot locate the preset package root (templates/ folder)');
}

/**
 * How a site depends on this package: the asset of its GitHub Release. The package is never
 * published to a registry, so there is no semver range: every site names the exact version it uses.
 */
export function defaultPresetSpec(): string {
  const { version } = JSON.parse(readFileSync(join(packageRoot(), 'package.json'), 'utf8')) as {
    version: string;
  };
  return `https://github.com/sxnnyside-project/astro-preset/releases/download/v${version}/sxnnyside-astro-preset-${version}.tgz`;
}

const template = (...parts: string[]) =>
  readFileSync(join(packageRoot(), 'templates', ...parts), 'utf8');

export function validate(options: ScaffoldOptions): void {
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(options.name))
    throw new Error(`name must be kebab-case: ${options.name}`);
  if (!/^https:\/\/[^/\s]+$/.test(options.origin))
    throw new Error(`origin must be an https origin without a path: ${options.origin}`);
  if (options.locales.length === 0 || options.locales.some((l) => !/^[a-z]{2}$/.test(l))) {
    throw new Error('locales must be two-letter codes, e.g. es,en');
  }
}

/** Every file of a new Sxnnyside Astro site, as relative path -> contents. */
export function buildSiteFiles(options: ScaffoldOptions): Record<string, string> {
  validate(options);
  const { name, origin, locales, org, orgName, presetSpec } = options;
  const [defaultLocale = 'es'] = locales;
  const siteName = title(name);
  const repo = `https://github.com/${org}/${name}`;
  const localeMap = `{ ${locales.map((l) => `${l}: '${tagOf(l)}'`).join(', ')} }`;
  const files: Record<string, string> = {};

  files['package.json'] = pretty({
    name,
    version: '0.1.0',
    description: `${siteName}, a Sxnnyside Project website.`,
    private: true,
    license: 'LicenseRef-SPL',
    author: { name: orgName, url: `https://github.com/${org}` },
    repository: { type: 'git', url: `git+${repo}.git` },
    homepage: `${repo}#readme`,
    bugs: { url: `${repo}/issues` },
    type: 'module',
    packageManager: 'bun@1.4.0',
    engines: { bun: '>=1.4.0' },
    scripts: {
      dev: 'astro dev',
      build: 'astro build',
      preview: 'astro preview',
      test: 'bun test',
      typecheck: 'astro check',
      lint: 'biome lint .',
      'lint:fix': 'biome lint --write .',
      format: 'biome format --write .',
      'format:check': 'biome format .',
      'check:csp': 'sxnnyside-astro-check csp',
      check:
        'bun run format:check && bun run lint && bun run typecheck && bun run test && bun run build && bun run check:csp',
      clean: 'rm -rf dist .astro',
      prepare: 'husky',
    },
    dependencies: { '@sxnnyside/astro-preset': presetSpec, astro: '7.3.5' },
    devDependencies: {
      '@astrojs/check': '0.9.10',
      '@biomejs/biome': '2.5.15',
      '@commitlint/cli': '21.2.3',
      '@commitlint/config-conventional': '21.2.3',
      '@types/bun': '1.4.2',
      husky: '9.1.7',
      typescript: '6.0.3',
    },
  });

  files.Justfile = `# ${siteName}: the command surface. Every recipe fails instead of skipping.

default:
    @just --list

install:
    bun install --frozen-lockfile

dev:
    bun run dev

build:
    bun run build

test:
    bun run test

typecheck:
    bun run typecheck

lint:
    bun run lint

format:
    bun run format

format-check:
    bun run format:check

# The CSP contract: what dist/ emits against what public/_headers allows.
csp: build
    bun run check:csp

# Non-mutating gate: what pre-commit and CI run.
check: format-check lint typecheck test csp

clean:
    bun run clean
`;

  files['astro.config.ts'] = `import { sxnnysideAstro } from '@sxnnyside/astro-preset';
import { site } from './src/lib/site';

export default sxnnysideAstro({
  site: site.origin,
  defaultLocale: site.defaultLocale,
  locales: site.localeTags,
});
`;
  files['uno.config.ts'] = `import { sxnnysideUno } from '@sxnnyside/astro-preset/uno';

export default sxnnysideUno();
`;
  files['tsconfig.json'] = pretty({
    extends: '@sxnnyside/astro-preset/tsconfig.base.json',
    compilerOptions: { types: ['bun'] },
    include: ['.astro/types.d.ts', '**/*'],
    exclude: ['dist'],
  });
  files['biome.json'] = pretty({
    $schema: 'https://biomejs.dev/schemas/2.5.15/schema.json',
    extends: ['@sxnnyside/astro-preset/biome.base.json'],
    vcs: { enabled: true, clientKind: 'git', useIgnoreFile: true },
    files: {
      ignoreUnknown: true,
      includes: ['**', '!dist', '!.astro', '!node_modules', '!bun.lock'],
    },
  });
  files['bunfig.toml'] = '[install]\nfrozenLockfile = true\n';
  files['commitlint.config.mjs'] = template('commitlint.config.mjs');
  files['.editorconfig'] = template('editorconfig');
  files['.gitattributes'] = template('gitattributes');
  files['.gitignore'] =
    'node_modules/\ndist/\n.astro/\npublic/remote/\n.env\n.env.*\n!.env.example\n.DS_Store\n';
  files['.husky/pre-commit'] = template('husky', 'pre-commit');
  files['.husky/commit-msg'] = template('husky', 'commit-msg');
  files['.github/workflows/ci.yml'] = template('ci.yml');

  files['README.md'] = `# ${siteName}

${siteName} is a Sxnnyside Project website built with Astro, UnoCSS and \`@sxnnyside/astro-preset\`, deployed on Cloudflare Pages at ${origin}.

## Development
\`\`\`bash
bun install      # first time: creates bun.lock; commit it
just dev
just check       # the gate: format, lint, typecheck, test, build and the CSP contract
\`\`\`

## Structure
See [CLAUDE.md](CLAUDE.md) for where things go.
`;

  files['CLAUDE.md'] = `# ${siteName}

An Astro static site (Cloudflare Pages) that depends on \`@sxnnyside/astro-preset\` for its configuration, URL contract, i18n core, SEO head and base styles.

## Commands
\`just\` is the interface; \`just check\` is the gate and runs on pre-commit and in CI.

## Where things go
| Kind | Location |
|---|---|
| Routes (file = URL) | \`src/pages/[locale]/\` (kebab-case; the root \`src/pages/index.astro\` only redirects) |
| Layouts | \`src/layouts/<name>-layout.astro\` (the base is \`BaseLayout.astro\`) |
| Components | \`src/components/<feature>/<name>.astro\` (kebab-case files) |
| Content collections | \`src/content/<collection>/\` + \`src/content.config.ts\` |
| Domain / data logic | \`src/domain/\`, \`src/lib/<concept>/\` (named by purpose, never \`utils\`) |
| Site URL contract | \`src/lib/site.ts\` (\`defineSite\`; the only place the origin and locales are written) |
| i18n copy | \`src/i18n/locales/<locale>.ts\`; helpers come from the preset |
| Design tokens | \`src/styles/tokens.css\` (CSS custom properties; UnoCSS only provides utilities and icons) |
| Processed assets | \`src/assets/\` |
| Static files | \`public/\` (\`_headers\` is required) |
| Tests | \`tests/\`, mirroring \`src/\` |

## Rules
- Every URL the site emits about itself goes through \`site.canonicalUrl\` / \`site.alternatesFor\`: trailing slash, no redirects.
- No inline scripts: the CSP is \`script-src 'self'\`; \`just check\` fails if \`dist/\` breaks it.
- Never commit unless asked.
`;

  // ---- the site ----------------------------------------------------------------------------
  files['src/env.d.ts'] = '/// <reference path="../.astro/types.d.ts" />\n';
  files['src/lib/site.ts'] = `import { defineSite } from '@sxnnyside/astro-preset/site';

export const site = defineSite({
  origin: '${origin}',
  locales: ${localeMap},
  defaultLocale: '${defaultLocale}',
});
`;
  files['src/i18n/index.ts'] = `import { createI18n } from '@sxnnyside/astro-preset/i18n';
import { site } from '../lib/site';
${[...locales]
  .sort()
  .map((l) => `import { ${l} } from './locales/${l}';`)
  .join('\n')}

const i18n = createI18n(site, { ${locales.join(', ')} });

export const { useTranslations, getLangFromPath, SUPPORTED_LANGS, DEFAULT_LOCALE } = i18n;
`;
  for (const [i, l] of locales.entries()) {
    files[`src/i18n/locales/${l}.ts`] =
      i === 0
        ? `export const ${l} = {\n  meta: { title: '${siteName}', description: 'Replace this description.' },\n  hero: { heading: '${siteName}' },\n};\n`
        : `import type { ${defaultLocale} } from './${defaultLocale}';\n\nexport const ${l}: typeof ${defaultLocale} = {\n  meta: { title: '${siteName}', description: 'Replace this description.' },\n  hero: { heading: '${siteName}' },\n};\n`;
  }
  files['src/layouts/BaseLayout.astro'] = `---
import SeoHead from '@sxnnyside/astro-preset/seo-head.astro';
import { site } from '../lib/site';
import '../styles/global.css';

interface Props {
  title: string;
  description: string;
  lang: ${locales.map((l) => `'${l}'`).join(' | ')};
  image?: string;
}

const { title, description, lang, image } = Astro.props;
---

<!doctype html>
<html lang={lang}>
  <head>
    <SeoHead site={site} title={title} description={description} lang={lang} siteName="${siteName}" {image} />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body>
    <slot />
  </body>
</html>
`;
  files['src/pages/index.astro'] = `---
import { site } from '../lib/site';

// A redirect with the trailing slash: a slashless target costs a second hop at the edge.
return Astro.redirect(site.rootRedirect, 301);
---
`;
  files['src/pages/[locale]/index.astro'] = `---
import BaseLayout from '../../layouts/BaseLayout.astro';
import { useTranslations } from '../../i18n';
import { site } from '../../lib/site';

export const getStaticPaths = () => site.localeStaticPaths();

const { locale } = Astro.params;
const t = useTranslations(locale);
---

<BaseLayout title={t.meta.title} description={t.meta.description} lang={locale}>
  <main>
    <h1>{t.hero.heading}</h1>
  </main>
</BaseLayout>
`;
  files['src/styles/global.css'] = `/**
 * Main style import orchestrator. Import it once, in BaseLayout. Order is intentional.
 */
@import '@sxnnyside/astro-preset/styles/reset.css';
@import './tokens.css';
@import '@sxnnyside/astro-preset/styles/typography.css';
`;
  files['src/styles/tokens.css'] = `/**
 * Design tokens: the only place colors, spacing and type are defined.
 * The preset's reset and typography read these custom properties.
 */
:root {
  --color-bg: #11001c;
  --color-text: #f5f0ff;
  --color-text-muted: #b9a9d4;
  --color-brand: #a855f7;

  --font-body: system-ui, sans-serif;
  --font-heading: system-ui, sans-serif;
  --font-identity: system-ui, sans-serif;
  --font-mono: ui-monospace, monospace;
  --font-ui: system-ui, sans-serif;

  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 1.875rem;
  --text-5xl: 3rem;
  --text-7xl: 4.5rem;

  --leading-tight: 1.2;
  --leading-normal: 1.6;

  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
}
`;
  files['public/_headers'] = sxnnysideHeaders();
  files['public/favicon.svg'] =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img"><title>${siteName}</title><rect width="32" height="32" rx="6" fill="#a855f7"/></svg>\n`;
  files['tests/site.test.ts'] = `import { expect, test } from 'bun:test';
import { site } from '../src/lib/site';

test('every URL the site emits about itself is canonical: trailing slash, no redirect hop', () => {
  expect(site.canonicalUrl('/${defaultLocale}/about')).toBe('${origin}/${defaultLocale}/about/');
  expect(site.rootRedirect).toBe('/${defaultLocale}/');
});
`;
  return files;
}
