import fs from 'node:fs';
import path from 'node:path';
import { REMOTE_ASSETS_DIR } from './remote';

export interface PictureProps {
  avif: string;
  webp: string;
  fallback: string;
  hasLocal: boolean;
}

const KNOWN_EXTENSION = /\.(avif|webp|png|jpe?g|gif|svg|tiff|bmp)$/i;

/**
 * Sources for a `<picture>`: the local AVIF/WebP pair when `basePath` is a processed
 * `/remote/<hash>` that exists on disk, otherwise the original URL.
 */
export function getPictureProps(
  basePath: string | null | undefined,
  fallbackUrl: string | null | undefined,
  assetsDir: string = REMOTE_ASSETS_DIR,
): PictureProps {
  if (!basePath) {
    const url = fallbackUrl ?? '';
    return { avif: url, webp: url, fallback: url, hasLocal: false };
  }

  // A path with an extension, an Astro/Vite static asset or a remote URL is returned as is.
  const withoutQuery = (basePath.split('?')[0] ?? '').split('#')[0] ?? '';
  const isAstroAsset = basePath.startsWith('/_astro/') || basePath.startsWith('/@fs/');
  const isRemote = basePath.startsWith('http://') || basePath.startsWith('https://');
  if (KNOWN_EXTENSION.test(withoutQuery) || isAstroAsset || isRemote) {
    return { avif: basePath, webp: basePath, fallback: basePath, hasLocal: false };
  }

  // `basePath` is `/remote/<hash>` (no extension): both optimized files must exist at build time.
  try {
    const hash = path.basename(basePath);
    if (
      fs.existsSync(path.join(assetsDir, `${hash}.avif`)) &&
      fs.existsSync(path.join(assetsDir, `${hash}.webp`))
    ) {
      return {
        avif: `${basePath}.avif`,
        webp: `${basePath}.webp`,
        fallback: `${basePath}.webp`,
        hasLocal: true,
      };
    }
  } catch (err) {
    // Non-fatal: keep the build resilient and fall back to the original URL.
    console.warn('[AssetPipeline] Could not verify local asset files for', basePath, err);
  }

  return {
    avif: fallbackUrl ?? `${basePath}.avif`,
    webp: fallbackUrl ?? `${basePath}.webp`,
    fallback: fallbackUrl ?? `${basePath}.webp`,
    hasLocal: false,
  };
}
