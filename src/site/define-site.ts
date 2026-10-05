/**
 * The public URL contract of a site, expressed once.
 *
 * Cloudflare Pages serves directory-index output at the TRAILING-SLASH form and 308-redirects the
 * slashless one (`/es/about` -> `/es/about/`), while flat error documents are served slashless
 * (`/404`). The trailing-slash form is therefore canonical, and every URL a site emits about itself
 * (canonical, hreflang, sitemap, internal links, JSON-LD `url`) must use it so that no
 * self-referential URL resolves through a redirect.
 */

export interface SiteOptions<L extends string> {
  /** Origin only, no trailing slash. Must equal `site` in `astro.config.ts`. */
  origin: string;
  /** Supported locales and their BCP 47 tags, e.g. `{ es: 'es-MX', en: 'en-US' }`. */
  locales: Readonly<Record<L, string>>;
  /** The locale of the root redirect and of `hreflang="x-default"`. */
  defaultLocale: NoInfer<L>;
  /** Routes Astro emits as a flat `<name>.html`; the edge serves them without a trailing slash. */
  flatRoutes?: readonly string[];
}

export type Alternates<L extends string> = Record<L, string> & { xDefault: string };

export interface Site<L extends string> {
  readonly origin: string;
  readonly locales: readonly L[];
  /** `{ es: 'es-MX', en: 'en-US' }`: reuse it for the sitemap `i18n.locales` and for `og:locale`. */
  readonly localeTags: Readonly<Record<L, string>>;
  readonly defaultLocale: L;
  /** Where `/` redirects to, with the trailing slash (`/es/`): a slashless target costs a second hop. */
  readonly rootRedirect: string;
  canonicalPath(pathname: string): string;
  canonicalUrl(pathname: string): string;
  splitLocale(pathname: string): { locale: L | null; rest: string };
  localizedUrl(locale: L, pathname: string): string;
  alternatesFor(pathname: string): Alternates<L>;
  /** The locale a path belongs to, or the default one when it has no locale segment. */
  getLangFromPath(pathname: string): L;
  /** `getStaticPaths()` for every `src/pages/[locale]/...` route. */
  localeStaticPaths(): { params: { locale: L } }[];
}

export function defineSite<L extends string>(options: SiteOptions<L>): Site<L> {
  const origin = options.origin.replace(/\/+$/, '');
  const locales = Object.keys(options.locales) as L[];
  const flat = new Set(options.flatRoutes ?? ['/404', '/500']);
  const isLocale = (s: string | undefined): s is L =>
    s !== undefined && (locales as string[]).includes(s);

  const canonicalPath = (pathname: string): string => {
    const [pathOnly = '', hash] = pathname.split('#');
    let p = pathOnly.trim();
    if (!p.startsWith('/')) p = `/${p}`;

    const withoutSlash = p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
    if (flat.has(withoutSlash)) return hash ? `${withoutSlash}#${hash}` : withoutSlash;

    const isFile = (p.split('/').pop() ?? '').includes('.');
    if (!isFile && !p.endsWith('/')) p = `${p}/`;
    return hash ? `${p}#${hash}` : p;
  };
  const canonicalUrl = (pathname: string) => `${origin}${canonicalPath(pathname)}`;

  const splitLocale = (pathname: string) => {
    const segments = canonicalPath(pathname).split('/').filter(Boolean);
    const first = segments[0];
    if (isLocale(first)) return { locale: first, rest: `/${segments.slice(1).join('/')}` };
    return { locale: null, rest: `/${segments.join('/')}` };
  };

  const localizedUrl = (locale: L, pathname: string) => {
    const { locale: current, rest } = splitLocale(pathname);
    if (current === null) return canonicalUrl(pathname); // 404, 500: not localised, refers to itself
    return canonicalUrl(`/${locale}${rest === '/' ? '' : rest}`);
  };

  return {
    origin,
    locales,
    localeTags: options.locales,
    defaultLocale: options.defaultLocale,
    rootRedirect: `/${options.defaultLocale}/`,
    canonicalPath,
    canonicalUrl,
    splitLocale,
    localizedUrl,
    alternatesFor: (pathname) => {
      const alternates = Object.fromEntries(
        locales.map((l) => [l, localizedUrl(l, pathname)]),
      ) as Record<L, string>;
      return { ...alternates, xDefault: alternates[options.defaultLocale] };
    },
    getLangFromPath: (pathname) => splitLocale(pathname).locale ?? options.defaultLocale,
    localeStaticPaths: () => locales.map((locale) => ({ params: { locale } })),
  };
}
