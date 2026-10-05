import fs from 'node:fs';
import path from 'node:path';
import { logBuild } from './logger';

interface AssetEntry {
  files: string[];
  cachedAt: string;
}

export interface AssetManifest {
  version: number;
  entries: Record<string, AssetEntry>;
}

export interface CacheStore {
  readonly dir: string;
  readManifest(): AssetManifest;
  writeManifest(manifest: AssetManifest): void;
  restore(manifest: AssetManifest, destDir: string): void;
  sync(manifest: AssetManifest, sourceDir: string): void;
}

const emptyManifest = (): AssetManifest => ({ version: 1, entries: {} });

/**
 * The persistent asset cache between builds. `ASSET_CACHE_PATH` overrides it for local and CI runs.
 * It defaults to `node_modules/.astro/<namespace>`: Cloudflare Pages only restores specific known
 * paths between builds (package-manager caches and, for Astro, `node_modules/.astro`), so an
 * arbitrary path is never restored. Keep a site's old `namespace` to keep its existing cache valid.
 */
export function createCacheStore(namespace = 'sxnnyside-assets'): CacheStore {
  const dir = process.env.ASSET_CACHE_PATH ?? path.join('node_modules', '.astro', namespace);
  const manifestPath = path.join(dir, 'manifest.json');

  const readable = () => fs.existsSync(dir);
  const ensureDir = (): boolean => {
    try {
      fs.mkdirSync(dir, { recursive: true });
      return true;
    } catch {
      return false;
    }
  };

  const store: CacheStore = {
    dir,
    readManifest() {
      if (!readable() || !fs.existsSync(manifestPath)) return emptyManifest();
      try {
        return JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as AssetManifest;
      } catch {
        return emptyManifest();
      }
    },
    writeManifest(manifest) {
      if (!ensureDir()) return;
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    },
    restore(manifest, destDir) {
      if (!readable()) return;
      const entries = Object.values(manifest.entries);
      if (entries.length === 0) {
        logBuild('AssetCache', 'Manifest empty: full download required');
        return;
      }
      let hits = 0;
      for (const entry of entries) {
        const paths = entry.files.map((f) => path.join(dir, f));
        const label = entry.files[0] ?? '(unknown)';
        if (!paths.every((p) => fs.existsSync(p))) {
          logBuild('AssetCache', `MISS: ${label}: processing`);
          continue;
        }
        for (const src of paths) {
          const dest = path.join(destDir, path.basename(src));
          if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
        }
        logBuild('AssetCache', `HIT: ${label}`);
        hits++;
      }
      logBuild('AssetCache', `Restored ${hits}/${entries.length} assets from persistent cache`);
    },
    sync(manifest, sourceDir) {
      if (!ensureDir() || !fs.existsSync(sourceDir)) return;
      const byHash = new Map<string, string[]>();
      for (const file of fs.readdirSync(sourceDir)) {
        const stem = path.basename(file, path.extname(file));
        byHash.set(stem, [...(byHash.get(stem) ?? []), file]);
      }
      let added = 0;
      for (const [hash, files] of byHash) {
        if (manifest.entries[hash]) continue;
        for (const file of files) fs.copyFileSync(path.join(sourceDir, file), path.join(dir, file));
        manifest.entries[hash] = { files, cachedAt: new Date().toISOString() };
        added++;
      }
      logBuild(
        'AssetCache',
        added > 0
          ? `Synced ${added} new assets to persistent cache`
          : 'No new assets: manifest unchanged',
      );
      store.writeManifest(manifest);
    },
  };
  return store;
}
