#!/usr/bin/env bun
/**
 * Gates and scaffolding shared by every Sxnnyside Astro site.
 *
 *   sxnnyside-astro-check csp [--dist dist] [--headers public/_headers] [--site https://example.com]
 *       Run from the site, after `astro build`. `--site` defaults to the `site:` found in
 *       `astro.config.*`, else the `origin:` of `src/lib/site.ts`.
 *
 *   sxnnyside-astro-check init <dir> --name <kebab-name> --origin <https://...> [--locales es,en]
 *       [--org sxnnyside-project] [--org-name "Sxnnyside Project"] [--preset <spec>] [--no-install]
 *       Writes a complete new site (config, URL contract, i18n, SEO head, base styles, hooks, CI,
 *       Justfile, CLAUDE.md) and runs `bun install` unless `--no-install` is given.
 */
import { existsSync, readFileSync } from 'node:fs';
import { defaultPresetSpec } from '../scaffold/files';
import { writeSite } from '../scaffold/write';
import { runCspCheck } from './csp/run';

function flag(args: readonly string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i > -1 ? args[i + 1] : undefined;
}

const SITE_SOURCES: ReadonlyArray<readonly [string, RegExp]> = [
  ['astro.config.ts', /\bsite:\s*['"]([^'"]+)['"]/],
  ['astro.config.mjs', /\bsite:\s*['"]([^'"]+)['"]/],
  ['astro.config.js', /\bsite:\s*['"]([^'"]+)['"]/],
  ['src/lib/site.ts', /\borigin:\s*['"]([^'"]+)['"]/],
];

function siteFromConfig(): string | undefined {
  for (const [file, pattern] of SITE_SOURCES) {
    if (!existsSync(file)) continue;
    const found = pattern.exec(readFileSync(file, 'utf8'));
    if (found?.[1]) return found[1];
  }
  return undefined;
}

function usage(): never {
  console.error(
    'usage: sxnnyside-astro-check csp [--dist dist] [--headers public/_headers] [--site <origin>]\n' +
      '       sxnnyside-astro-check init <dir> --name <kebab-name> --origin <https://...> [--locales es,en]',
  );
  return process.exit(2);
}

const [command, ...args] = process.argv.slice(2);

if (command === 'csp') {
  const site = flag(args, '--site') ?? siteFromConfig();
  if (!site) {
    console.error(
      '✗ cannot tell the production origin: pass --site or set it in astro.config.* or src/lib/site.ts',
    );
    process.exit(2);
  }
  runCspCheck({
    dist: flag(args, '--dist') ?? 'dist',
    headers: flag(args, '--headers') ?? 'public/_headers',
    site,
  });
} else if (command === 'init') {
  const dir = args[0]?.startsWith('--') ? undefined : args[0];
  const name = flag(args, '--name');
  const origin = flag(args, '--origin');
  if (!dir || !name || !origin) usage();
  const written = writeSite(dir as string, {
    name: name as string,
    origin: origin as string,
    locales: (flag(args, '--locales') ?? 'es,en').split(','),
    org: flag(args, '--org') ?? 'sxnnyside-project',
    orgName: flag(args, '--org-name') ?? 'Sxnnyside Project',
    presetSpec: flag(args, '--preset') ?? defaultPresetSpec(),
  });
  console.log(`created ${written.length} files in ${dir}`);
  if (!args.includes('--no-install')) {
    const res = Bun.spawnSync(['bun', 'install'], {
      cwd: dir as string,
      stdout: 'inherit',
      stderr: 'inherit',
    });
    if (res.exitCode !== 0) process.exit(res.exitCode);
  }
} else {
  usage();
}
