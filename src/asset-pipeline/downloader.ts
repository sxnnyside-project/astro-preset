import { logWarn } from './logger';

export const DEFAULT_RETRY_DELAYS_MS: readonly number[] = [500, 1000, 2000];

/**
 * Downloads an `https://` asset with one initial attempt and one retry per delay.
 * Returns `null` (never throws) so callers can fall back to the original URL.
 */
export async function downloadAsset(
  url: string | null | undefined,
  delays: readonly number[] = DEFAULT_RETRY_DELAYS_MS,
): Promise<Buffer | null> {
  if (!url?.startsWith('https://')) return null;

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return Buffer.from(await response.arrayBuffer());
    } catch {
      const delay = delays[attempt];
      if (delay === undefined) {
        logWarn(
          'AssetPipeline',
          `Failed to download ${url} after ${attempt + 1} attempts: using fallback`,
        );
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return null;
}
