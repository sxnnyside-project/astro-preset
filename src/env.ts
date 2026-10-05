import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroConfig, AstroIntegration } from 'astro';
import { loadEnv } from 'vite';

/**
 * Loads the `.env*` files of the project into `process.env` without overwriting variables that are
 * already set, and returns how many it read. `astro:config:setup` runs before Vite injects them, so
 * anything that needs them at that point (a CMS client, an asset pipeline) must load them itself.
 */
export function loadEnvFiles(config: Pick<AstroConfig, 'root' | 'vite'>): number {
  const root = fileURLToPath(config.root);
  const envDir = config.vite?.envDir ? path.resolve(root, config.vite.envDir) : root;
  const env = loadEnv('production', envDir, '');
  for (const [key, value] of Object.entries(env)) {
    if (!(key in process.env)) process.env[key] = value;
  }
  return Object.keys(env).length;
}

/** An integration that loads the project's `.env*` files before any other integration runs. */
export function envLoader(): AstroIntegration {
  return {
    name: 'sxnnyside-env-loader',
    hooks: {
      'astro:config:setup': ({ config }) => {
        loadEnvFiles(config);
      },
    },
  };
}
