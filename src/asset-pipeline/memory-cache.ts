import { logBuild } from './logger';

/** URL -> web path of assets already processed in this build. */
export const assetCache = new Map<string, string>();
/** Downloads in flight, so concurrent requests for one URL share a single download. */
export const inFlightDownloads = new Map<string, Promise<string | null>>();

export function getCached(url: string): string | undefined {
  return assetCache.get(url);
}

export function setCached(url: string, basePath: string): void {
  assetCache.set(url, basePath);
}

/** Clears the in-memory cache only when `FORCE_REBUILD=true`; otherwise it survives dev reloads. */
export function clearCache(): void {
  if (process.env.FORCE_REBUILD === 'true') {
    logBuild('AssetCache', 'FORCE_REBUILD: in-memory cache cleared');
    assetCache.clear();
  } else {
    logBuild('AssetCache', 'In-memory cache retained');
  }
}
