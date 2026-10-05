import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { downloadAsset } from './downloader';
import { logBuild } from './logger';
import { getCached, inFlightDownloads, setCached } from './memory-cache';

export const REMOTE_ASSETS_DIR = path.join(process.cwd(), 'public', 'remote');
export const REMOTE_ASSETS_WEB_PATH = '/remote';

// The asset host stores a pre-generated AVIF next to every WebP at the same URL (extension
// swapped): nothing is re-encoded locally, both files are just fetched.
function siblingAvifUrl(webpUrl: string): string {
  return webpUrl.replace(/\.webp$/i, '.avif');
}

/**
 * Downloads a remote image once (AVIF + WebP) into `destDir` and returns its extension-less web
 * path (`/remote/<hash>`), or `null` when the URL is not https or a download failed.
 */
export async function processUrl(
  url: string | null | undefined,
  destDir: string,
): Promise<string | null> {
  if (!url?.startsWith('https://')) return null;

  const memoryCached = getCached(url);
  if (memoryCached) return memoryCached;

  const inFlight = inFlightDownloads.get(url);
  if (inFlight) return inFlight;

  const promise = downloadAndCache(url, destDir);
  inFlightDownloads.set(url, promise);
  try {
    return await promise;
  } finally {
    inFlightDownloads.delete(url);
  }
}

async function downloadAndCache(url: string, destDir: string): Promise<string | null> {
  const hash = crypto.createHash('md5').update(url).digest('hex');
  const diskPath = path.join(destDir, hash);
  const webPath = `${REMOTE_ASSETS_WEB_PATH}/${hash}`;

  if (fs.existsSync(`${diskPath}.avif`) && fs.existsSync(`${diskPath}.webp`)) {
    setCached(url, webPath);
    logBuild('AssetPipeline', `Cache hit (disk): ${hash}`);
    return webPath;
  }

  fs.mkdirSync(destDir, { recursive: true });

  const avifUrl = /\.webp$/i.test(url) ? siblingAvifUrl(url) : url;
  const startDownload = performance.now();
  const [avifBuffer, webpBuffer] = await Promise.all([downloadAsset(avifUrl), downloadAsset(url)]);
  if (!avifBuffer || !webpBuffer) return null;

  fs.writeFileSync(`${diskPath}.avif`, avifBuffer);
  fs.writeFileSync(`${diskPath}.webp`, webpBuffer);

  setCached(url, webPath);
  logBuild(
    'AssetPipeline',
    `Downloaded & cached asset: ${hash}`,
    `took ${Math.round(performance.now() - startDownload)}ms`,
  );
  return webPath;
}

/** Replaces the listed string fields of an object with their processed web paths (the original URL on failure). */
export async function processProjectImages<T extends object>(
  project: T,
  imageFields: (keyof T)[],
  destDir: string,
): Promise<T> {
  const updates = await Promise.all(
    imageFields.map(async (field) => {
      const value = (project as Record<keyof T, unknown>)[field];
      if (typeof value !== 'string') return [field, value] as const;
      const result = await processUrl(value, destDir);
      return [field, result ?? value] as const;
    }),
  );

  const copy = { ...project } as Record<keyof T, unknown>;
  for (const [field, result] of updates) copy[field] = result;
  return copy as unknown as T;
}
