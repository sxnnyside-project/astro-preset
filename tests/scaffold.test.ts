import { afterAll, describe, expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sxnnysideHeaders } from '../src/headers';
import { buildSiteFiles, defaultPresetSpec, type ScaffoldOptions } from '../src/scaffold/files';
import { writeSite } from '../src/scaffold/write';
import { skillPath, skillsDir } from './skills-dir';

const options: ScaffoldOptions = {
  name: 'docs-website',
  origin: 'https://docs.sxnnysideproject.com',
  locales: ['es', 'en'],
  org: 'sxnnyside-project',
  orgName: 'Sxnnyside Project',
  presetSpec: '^0.2.0',
};

const skill = (...p: string[]) => readFileSync(skillPath(...p), 'utf8');
const tmp = mkdtempSync(join(tmpdir(), 'preset-scaffold-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('buildSiteFiles', () => {
  const files = buildSiteFiles(options);

  test('carries the structure the four sites already share', () => {
    for (const path of [
      'package.json',
      'Justfile',
      'astro.config.ts',
      'uno.config.ts',
      'biome.json',
      'tsconfig.json',
      'CLAUDE.md',
      'README.md',
      '.gitignore',
      '.editorconfig',
      '.gitattributes',
      'src/env.d.ts',
      'src/i18n/index.ts',
      'src/i18n/locales/es.ts',
      'src/i18n/locales/en.ts',
      'src/layouts/BaseLayout.astro',
      'src/lib/site.ts',
      'src/pages/index.astro',
      'src/pages/[locale]/index.astro',
      'src/styles/global.css',
      'src/styles/tokens.css',
      'public/_headers',
      'tests/site.test.ts',
    ]) {
      expect(files[path]).toBeDefined();
    }
  });

  test('the dynamic route parameter is `locale`, never `lang`', () => {
    expect(Object.keys(files).filter((f) => f.includes('[lang]'))).toEqual([]);
    expect(files['src/pages/[locale]/index.astro']).toContain('site.localeStaticPaths()');
  });

  test('the root redirect keeps the trailing slash', () => {
    expect(files['src/pages/index.astro']).toContain('site.rootRedirect');
    expect(files['src/lib/site.ts']).toContain("defaultLocale: 'es'");
  });

  test('package.json has the canonical script set, a pinned toolchain and the preset', () => {
    const pkg = JSON.parse(files['package.json'] as string) as {
      scripts: Record<string, string>;
      packageManager: string;
      private: boolean;
      license: string;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    for (const s of [
      'dev',
      'build',
      'test',
      'typecheck',
      'lint',
      'lint:fix',
      'format',
      'format:check',
      'check',
      'clean',
      'prepare',
    ]) {
      expect(pkg.scripts[s]).toBeDefined();
    }
    expect(pkg.scripts.check).not.toContain('bun run format ');
    expect(pkg.packageManager).toBe('bun@1.4.0');
    expect(pkg.private).toBe(true);
    expect(pkg.license).toBe('LicenseRef-SPL');
    expect(pkg.dependencies['@sxnnyside/astro-preset']).toBe('^0.2.0');
    expect(pkg.devDependencies.typescript).toBe('6.0.3'); // Astro sites stay on 6.0 while astro check refuses 7
  });

  test('the Justfile check is non-mutating and includes the CSP contract', () => {
    const justfile = files.Justfile as string;
    expect(justfile).toContain('check: format-check lint typecheck test csp');
    expect(justfile).toContain('csp: build');
  });

  test.skipIf(skillsDir === null)(
    'files shared with the skills are byte-identical to the skill templates',
    () => {
      expect(files['.editorconfig']).toBe(
        skill('standards', 'text-normalization', 'templates', '.editorconfig'),
      );
      expect(files['.gitattributes']).toBe(
        skill('standards', 'text-normalization', 'templates', '.gitattributes'),
      );
      expect(files['commitlint.config.mjs']).toBe(
        skill('languages', 'typescript', 'config', 'templates', 'commitlint.config.mjs'),
      );
      expect(files['.husky/pre-commit']).toBe(
        skill('languages', 'typescript', 'config', 'templates', 'husky', 'pre-commit'),
      );
      expect(files['.husky/commit-msg']).toBe(
        skill('languages', 'typescript', 'config', 'templates', 'husky', 'commit-msg'),
      );
      expect(files['public/_headers']).toBe(
        skill('program-types', 'web-astro', 'templates', 'public', '_headers'),
      );
      expect(files['public/_headers']).toBe(sxnnysideHeaders());
    },
  );

  test('CI uses pinned actions and runs the gate', () => {
    const ci = files['.github/workflows/ci.yml'] as string;
    expect(ci).toContain('just check');
    expect(ci.match(/uses: [^\s]+@[0-9a-f]{40}/g)?.length).toBeGreaterThanOrEqual(3);
    expect(ci).not.toMatch(/-latest/);
  });

  test('more locales mean more dictionaries typed against the default one', () => {
    const f = buildSiteFiles({ ...options, locales: ['en', 'es', 'pt'] });
    expect(f['src/i18n/locales/pt.ts']).toContain('typeof en');
    expect(f['src/lib/site.ts']).toContain("pt: 'pt'");
    expect(f['src/lib/site.ts']).toContain("defaultLocale: 'en'");
  });

  test('rejects names, origins and locales that break the standard', () => {
    expect(() => buildSiteFiles({ ...options, name: 'Docs_Site' })).toThrow('kebab-case');
    expect(() => buildSiteFiles({ ...options, origin: 'http://x.com' })).toThrow('https origin');
    expect(() => buildSiteFiles({ ...options, origin: 'https://x.com/path' })).toThrow(
      'https origin',
    );
    expect(() => buildSiteFiles({ ...options, locales: [] })).toThrow('locales');
    expect(() => buildSiteFiles({ ...options, locales: ['english'] })).toThrow('locales');
  });
});

describe('defaultPresetSpec', () => {
  test('points at the GitHub Release asset of the package version, never at a registry range', () => {
    const { version } = JSON.parse(
      readFileSync(join(import.meta.dir, '..', 'package.json'), 'utf8'),
    ) as { version: string };
    expect(defaultPresetSpec()).toBe(
      `https://github.com/sxnnyside-project/astro-preset/releases/download/v${version}/sxnnyside-astro-preset-${version}.tgz`,
    );
  });
});

describe('writeSite', () => {
  test('writes every file, makes hooks executable and refuses a non-empty folder', () => {
    const dir = join(tmp, 'site');
    const written = writeSite(dir, options);
    expect(written).toHaveLength(Object.keys(buildSiteFiles(options)).length);
    expect(existsSync(join(dir, 'src', 'pages', '[locale]', 'index.astro'))).toBe(true);
    expect(statSync(join(dir, '.husky', 'pre-commit')).mode & 0o111).not.toBe(0);
    expect(() => writeSite(dir, options)).toThrow('not empty');
    const other = join(tmp, 'occupied');
    mkdirSync(other);
    writeFileSync(join(other, 'x'), '');
    expect(() => writeSite(other, options)).toThrow('not empty');
  });
});
