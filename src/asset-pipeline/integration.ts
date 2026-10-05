import fs from 'node:fs';
import type { AstroIntegration } from 'astro';
import { loadEnvFiles } from '../env';
import { logBuild, timeAction } from './logger';
import { clearCache } from './memory-cache';
import { REMOTE_ASSETS_DIR } from './remote';
import { createCacheStore } from './store';

export interface AssetPipelineOptions {
  /** Integration name shown in Astro's logs. */
  name?: string;
  /** Persistent cache folder under `node_modules/.astro/`. Keep a site's old value to keep its cache valid. */
  namespace?: string;
  /**
   * The site's own fetching step (CMS queries that call `processUrl`/`processProjectImages`).
   * It runs after the persistent cache is restored and before it is synced back.
   */
  produce: () => Promise<void> | void;
}

/** Downloads remote images once per build, restores and syncs the persistent cache around it. */
export function createAssetPipeline(options: AssetPipelineOptions): AstroIntegration {
  const store = createCacheStore(options.namespace);
  let buildTimer: ReturnType<typeof timeAction> | undefined;
  return {
    name: options.name ?? 'sxnnyside-asset-pipeline',
    hooks: {
      'astro:config:setup': async ({ config }) => {
        const end = timeAction('AssetPipeline', 'Starting asset pipeline integration setup');
        logBuild('AssetPipeline', `Environment loaded with ${loadEnvFiles(config)} variables`);
        clearCache();
        fs.mkdirSync(REMOTE_ASSETS_DIR, { recursive: true });
        logBuild('AssetPipeline', `Remote assets directory ready: ${REMOTE_ASSETS_DIR}`);

        const manifest = store.readManifest();
        if (process.env.FORCE_REBUILD === 'true') {
          logBuild('AssetCache', 'FORCE_REBUILD enabled: skipping cache restore');
        } else {
          store.restore(manifest, REMOTE_ASSETS_DIR);
        }
        await options.produce();
        store.sync(manifest, REMOTE_ASSETS_DIR);

        end(
          'Asset pipeline setup finished',
          `${fs.readdirSync(REMOTE_ASSETS_DIR).length} remote assets available`,
        );
      },
      'astro:build:start': () => {
        buildTimer = timeAction('Astro:Build', 'Starting Astro static build');
      },
      'astro:build:done': ({ pages }) => {
        buildTimer?.('Astro static build completed', `${pages.length} pages generated`);
      },
    },
  };
}
