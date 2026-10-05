import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { downloadAsset } from '../src/asset-pipeline/downloader';
import { assetCache, inFlightDownloads } from '../src/asset-pipeline/memory-cache';
import { getPictureProps } from '../src/asset-pipeline/picture';
import { processProjectImages, processUrl } from '../src/asset-pipeline/remote';
import { createCacheStore } from '../src/asset-pipeline/store';
import { loadEnvFiles } from '../src/env';

const realFetch = globalThis.fetch;
const realWarn = console.warn;
const realLog = console.log;
let tmp = '';
let calls: string[] = [];

const mockFetch = (handler: (url: string, n: number) => Response) => {
  calls = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    return handler(url, calls.length);
  }) as typeof fetch;
};

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), 'preset-assets-'));
  console.log = () => undefined; // the pipeline logs every step
  console.warn = () => undefined;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  assetCache.clear();
  inFlightDownloads.clear();
});
afterAll(() => {
  console.log = realLog;
  console.warn = realWarn;
  rmSync(tmp, { recursive: true, force: true });
});

describe('downloadAsset', () => {
  test('only https URLs are fetched', async () => {
    mockFetch(() => new Response('x'));
    expect(await downloadAsset('http://a.test/x.webp')).toBeNull();
    expect(await downloadAsset(null)).toBeNull();
    expect(calls).toEqual([]);
  });

  test('retries once per delay, then succeeds', async () => {
    mockFetch((_url, n) => (n < 3 ? new Response('no', { status: 503 }) : new Response('ok')));
    const buf = await downloadAsset('https://a.test/x.webp', [0, 0, 0]);
    expect(buf?.toString()).toBe('ok');
    expect(calls).toHaveLength(3);
  });

  test('gives up with null after the last retry', async () => {
    mockFetch(() => new Response('no', { status: 500 }));
    expect(await downloadAsset('https://a.test/x.webp', [0, 0])).toBeNull();
    expect(calls).toHaveLength(3);
  });
});

describe('processUrl', () => {
  test('two concurrent calls share one download of both files; a third is served from memory', async () => {
    mockFetch((url) => new Response(url.endsWith('.avif') ? 'AVIF' : 'WEBP'));
    const dest = join(tmp, 'remote');
    const url = 'https://cdn.test/a/hero.webp';
    const [a, b] = await Promise.all([processUrl(url, dest), processUrl(url, dest)]);
    expect(a).toBe(b);
    expect(a).toMatch(/^\/remote\/[0-9a-f]{32}$/);
    expect(calls.sort()).toEqual(['https://cdn.test/a/hero.avif', 'https://cdn.test/a/hero.webp']);
    const hash = (a as string).split('/').pop() as string;
    expect(readFileSync(join(dest, `${hash}.avif`), 'utf8')).toBe('AVIF');
    expect(readFileSync(join(dest, `${hash}.webp`), 'utf8')).toBe('WEBP');
    await processUrl(url, dest);
    expect(calls).toHaveLength(2);
  });

  test('a failed download returns null and leaves the original URL in processProjectImages', async () => {
    mockFetch(() => new Response('no', { status: 404 }));
    const original = { icon: 'https://cdn.test/b/icon.webp', name: 'x', n: 3 };
    const out = await processProjectImages(original, ['icon', 'n'], join(tmp, 'remote2'));
    expect(out).toEqual(original);
  });
});

describe('getPictureProps', () => {
  const pictures = () => join(tmp, 'pictures');
  test('no base path uses the fallback for every source', () => {
    expect(getPictureProps(null, 'https://x/y.png', pictures())).toEqual({
      avif: 'https://x/y.png',
      webp: 'https://x/y.png',
      fallback: 'https://x/y.png',
      hasLocal: false,
    });
  });

  test('paths with an extension, Astro assets and remote URLs are returned untouched', () => {
    for (const p of ['/a/b.png', '/_astro/x.123.webp?v=1', 'https://x/y']) {
      expect(getPictureProps(p, null, pictures())).toMatchObject({
        avif: p,
        webp: p,
        hasLocal: false,
      });
    }
  });

  test('a processed hash resolves to the local pair only when both files exist', () => {
    mkdirSync(pictures(), { recursive: true });
    writeFileSync(join(pictures(), 'abc.webp'), 'w');
    expect(getPictureProps('/remote/abc', 'https://o/u.webp', pictures())).toMatchObject({
      hasLocal: false,
      fallback: 'https://o/u.webp',
    });
    writeFileSync(join(pictures(), 'abc.avif'), 'a');
    expect(getPictureProps('/remote/abc', 'https://o/u.webp', pictures())).toEqual({
      avif: '/remote/abc.avif',
      webp: '/remote/abc.webp',
      fallback: '/remote/abc.webp',
      hasLocal: true,
    });
  });
});

describe('createCacheStore', () => {
  test('syncs new assets once and restores them into a fresh folder', () => {
    const prev = process.env.ASSET_CACHE_PATH;
    process.env.ASSET_CACHE_PATH = join(tmp, 'persist');
    try {
      const store = createCacheStore('ns');
      const src = join(tmp, 'public-remote');
      mkdirSync(src, { recursive: true });
      writeFileSync(join(src, 'h1.avif'), '1');
      writeFileSync(join(src, 'h1.webp'), '2');
      const manifest = store.readManifest();
      store.sync(manifest, src);
      expect(Object.keys(store.readManifest().entries)).toEqual(['h1']);
      store.sync(store.readManifest(), src);
      expect(readdirSync(store.dir).sort()).toEqual(['h1.avif', 'h1.webp', 'manifest.json']);

      const fresh = join(tmp, 'fresh');
      mkdirSync(fresh, { recursive: true });
      store.restore(store.readManifest(), fresh);
      expect(readdirSync(fresh).sort()).toEqual(['h1.avif', 'h1.webp']);
    } finally {
      if (prev === undefined) delete process.env.ASSET_CACHE_PATH;
      else process.env.ASSET_CACHE_PATH = prev;
    }
  });

  test('defaults to node_modules/.astro/<namespace>', () => {
    const prev = process.env.ASSET_CACHE_PATH;
    delete process.env.ASSET_CACHE_PATH;
    try {
      expect(createCacheStore('extensions-assets').dir).toBe(
        join('node_modules', '.astro', 'extensions-assets'),
      );
      expect(createCacheStore().dir).toBe(join('node_modules', '.astro', 'sxnnyside-assets'));
    } finally {
      if (prev !== undefined) process.env.ASSET_CACHE_PATH = prev;
    }
  });
});

describe('loadEnvFiles', () => {
  test('loads .env without overwriting variables that are already set', () => {
    const root = join(tmp, 'site');
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, '.env'), 'PRESET_TEST_A=from-file\nPRESET_TEST_B=from-file\n');
    process.env.PRESET_TEST_B = 'from-shell';
    const n = loadEnvFiles({ root: new URL(`file://${root}/`), vite: {} });
    expect(n).toBeGreaterThanOrEqual(2);
    expect(process.env.PRESET_TEST_A).toBe('from-file');
    expect(process.env.PRESET_TEST_B).toBe('from-shell');
    expect(existsSync(root)).toBe(true);
  });
});
