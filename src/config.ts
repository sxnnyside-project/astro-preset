import sitemap from '@astrojs/sitemap';
import UnoCSS from '@unocss/astro';
import type { AstroUserConfig } from 'astro';
import { defineConfig } from 'astro/config';
import { ViteToml } from 'vite-plugin-toml';
import { merge } from './merge';
import { type SitemapPolicy, sitemapFilter, sitemapSerialize } from './sitemap';

export interface SxnnysideAstroOptions {
  /** The real production URL, e.g. `https://example.sxnnysideproject.com`. */
  site: string;
  /** Locale used for the root of the sitemap i18n block, e.g. `en`. */
  defaultLocale: string;
  /** Sitemap locales, e.g. `{ en: 'en-US', es: 'es-MX' }`. */
  locales: Readonly<Record<string, string>>;
  /** Sitemap exclusions and priority rules. */
  sitemap?: SitemapPolicy;
  /** Load `.toml` files as modules with `vite-plugin-toml`. */
  toml?: boolean;
  /**
   * Keep component scripts external so a `script-src 'self'` policy (the default `_headers`) never
   * blocks them. Turn off only for a site whose CSP uses nonces.
   */
  strictCsp?: boolean;
}

/** Vite inlines small chunks into the HTML; returning `false` for JS keeps them as `/_astro/*.js`. */
const keepScriptsExternal = (filePath: string): boolean | undefined =>
  /\.m?js$/.test(filePath) ? false : undefined;

/**
 * The canonical Astro configuration of a Sxnnyside static site on Cloudflare Pages.
 * `overrides` is merged on top: plain objects merge, `integrations` and `vite.plugins` append,
 * any other key replaces. An SSR site passes `output`, `adapter` and its own `trailingSlash` there.
 */
export function sxnnysideAstro(
  options: SxnnysideAstroOptions,
  overrides: AstroUserConfig = {},
): ReturnType<typeof defineConfig> {
  const policy = options.sitemap ?? {};
  const serialize = sitemapSerialize(policy);
  const vite: NonNullable<AstroUserConfig['vite']> = {
    ...(options.strictCsp === false ? {} : { build: { assetsInlineLimit: keepScriptsExternal } }),
    ...(options.toml ? { plugins: [ViteToml()] } : {}),
  };
  const base: AstroUserConfig = {
    site: options.site,
    trailingSlash: 'always',
    compressHTML: true,
    build: { inlineStylesheets: 'auto' },
    integrations: [
      UnoCSS({ injectReset: false }),
      sitemap({
        i18n: { defaultLocale: options.defaultLocale, locales: { ...options.locales } },
        filter: sitemapFilter(policy),
        ...(serialize ? { serialize } : {}),
      }),
    ],
    ...(Object.keys(vite).length > 0 ? { vite } : {}),
  };
  return defineConfig(merge(base as Record<string, unknown>, overrides as Record<string, unknown>));
}
