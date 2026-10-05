import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sxnnysideAstro } from '../src/config';
import { sxnnysideHeaders } from '../src/headers';
import { merge } from '../src/merge';
import { sxnnysideUno } from '../src/uno';
import { skillPath, skillsDir } from './skills-dir';

const PKG = join(import.meta.dir, '..');
const json = (file: string) =>
  JSON.parse(readFileSync(join(PKG, file), 'utf8')) as Record<string, unknown>;

const options = {
  site: 'https://demo.sxnnysideproject.com',
  defaultLocale: 'en',
  locales: { en: 'en-US', es: 'es-MX' },
};

describe('sxnnysideAstro', () => {
  const cfg = sxnnysideAstro(options) as Record<string, unknown>;

  test('carries the canonical keys, in the canonical order', () => {
    expect(Object.keys(cfg).slice(0, 5)).toEqual([
      'site',
      'trailingSlash',
      'compressHTML',
      'build',
      'integrations',
    ]);
    expect(cfg.trailingSlash).toBe('always');
    expect(cfg.compressHTML).toBe(true);
    expect(cfg.build).toEqual({ inlineStylesheets: 'auto' });
  });

  test('registers UnoCSS and the sitemap', () => {
    const names = (cfg.integrations as Array<{ name: string }>).map((i) => i.name);
    expect(names).toEqual(['unocss', '@astrojs/sitemap']);
  });

  test('overrides merge: objects merge, integrations append, scalars replace', () => {
    const out = sxnnysideAstro(options, {
      trailingSlash: 'never',
      build: { format: 'file' },
      integrations: [{ name: 'extra', hooks: {} }],
    }) as Record<string, unknown>;
    expect(out.trailingSlash).toBe('never');
    expect(out.build).toEqual({ inlineStylesheets: 'auto', format: 'file' });
    expect((out.integrations as Array<{ name: string }>).map((i) => i.name)).toEqual([
      'unocss',
      '@astrojs/sitemap',
      'extra',
    ]);
  });

  test('toml adds exactly one vite plugin', () => {
    const out = sxnnysideAstro({ ...options, toml: true }) as { vite?: { plugins?: unknown[] } };
    expect(out.vite?.plugins).toHaveLength(1);
  });

  test('keeps JS chunks external so script-src self never blocks a component script', () => {
    const limit = (
      sxnnysideAstro(options) as {
        vite?: { build?: { assetsInlineLimit?: (f: string) => boolean | undefined } };
      }
    ).vite?.build?.assetsInlineLimit as (f: string) => boolean | undefined;
    expect(limit('/src/a.js')).toBe(false);
    expect(limit('/src/a.mjs')).toBe(false);
    expect(limit('/src/a.css')).toBeUndefined();
    expect(
      (sxnnysideAstro({ ...options, strictCsp: false }) as { vite?: unknown }).vite,
    ).toBeUndefined();
  });
});

describe('sxnnysideUno', () => {
  const cfg = sxnnysideUno({ safelist: ['x'] }) as {
    presets?: unknown[];
    theme?: unknown;
    safelist?: string[];
  };
  test('layout utilities and icons only, no theme tokens', () => {
    expect(cfg.presets).toHaveLength(2);
    expect(cfg.theme).toEqual({});
    expect(cfg.safelist).toEqual(['sr-only', 'x']);
  });
});

describe('sxnnysideHeaders', () => {
  test.skipIf(skillsDir === null)(
    'without options it is byte-identical to the template of the Astro skill',
    () => {
      const template = readFileSync(
        skillPath('program-types', 'web-astro', 'templates', 'public', '_headers'),
        'utf8',
      );
      expect(sxnnysideHeaders()).toBe(template);
    },
  );

  test('adds connect and frame origins and never relaxes script-src', () => {
    const out = sxnnysideHeaders({
      connectSrc: ['https://api.example.com'],
      frameSrc: ['https://www.youtube.com'],
    });
    expect(out).toContain("connect-src 'self' https://api.example.com;");
    expect(out).toContain('frame-src https://www.youtube.com; frame-ancestors');
    expect(out).toContain("script-src 'self';");
  });
});

describe('merge', () => {
  test('does not mutate its inputs', () => {
    const base = { a: { b: 1 }, list: [1] };
    merge(base, { a: { c: 2 }, list: [2] });
    expect(base).toEqual({ a: { b: 1 }, list: [1] });
  });
});

describe('shared bases', () => {
  test('tsconfig base turns on every strict flag the standard asks for', () => {
    const co = json('tsconfig.base.json').compilerOptions as Record<string, unknown>;
    for (const flag of [
      'strict',
      'noUncheckedIndexedAccess',
      'exactOptionalPropertyTypes',
      'noImplicitOverride',
      'noImplicitReturns',
      'noFallthroughCasesInSwitch',
      'isolatedModules',
      'verbatimModuleSyntax',
    ]) {
      expect(co[flag]).toBe(true);
    }
    expect(json('tsconfig.base.json').extends).toBe('astro/tsconfigs/strict');
  });

  test('biome base is the single formatter profile of the fleet', () => {
    const b = json('biome.base.json') as {
      formatter: Record<string, unknown>;
      javascript: { formatter: Record<string, unknown> };
    };
    expect(b.formatter).toMatchObject({
      indentStyle: 'space',
      indentWidth: 2,
      lineWidth: 100,
      lineEnding: 'lf',
    });
    expect(b.javascript.formatter).toEqual({
      quoteStyle: 'single',
      semicolons: 'always',
      trailingCommas: 'all',
    });
  });
});
