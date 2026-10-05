import type { SitemapOptions } from '@astrojs/sitemap';
import type { EnumChangefreq } from 'sitemap';

export type Changefreq = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

/** A priority rule. A page matches when its slashless URL equals one of `equals` or contains one of `includes`. */
export interface SitemapRule {
  equals?: readonly string[];
  includes?: readonly string[];
  changefreq: Changefreq;
  priority: number;
}

export interface SitemapPolicy {
  /** URL fragments kept out of the sitemap, in addition to `/404` and `/500`. */
  exclude?: readonly string[];
  /** Full URLs kept out of the sitemap (for example a root that only redirects). */
  excludeExact?: readonly string[];
  /** First matching rule wins. Without rules, the sitemap keeps its defaults. */
  rules?: readonly SitemapRule[];
  /** Applied to pages no rule matched. */
  fallback?: { changefreq: Changefreq; priority: number };
}

const DEFAULT_FALLBACK = { changefreq: 'monthly', priority: 0.5 } as const;

/** Rules compare on the slashless form, so they do not depend on the `trailingSlash` contract. */
const slashless = (url: string) => url.replace(/\/$/, '');

export function sitemapFilter(
  policy: SitemapPolicy,
): NonNullable<NonNullable<SitemapOptions>['filter']> {
  const fragments = ['/404', '/500', ...(policy.exclude ?? [])];
  const exact = new Set((policy.excludeExact ?? []).map(slashless));
  return (page) => !fragments.some((f) => page.includes(f)) && !exact.has(slashless(page));
}

export function sitemapSerialize(
  policy: SitemapPolicy,
): NonNullable<SitemapOptions>['serialize'] | undefined {
  const rules = policy.rules ?? [];
  if (rules.length === 0) return undefined;
  const fallback = policy.fallback ?? DEFAULT_FALLBACK;
  return (item) => {
    const url = slashless(item.url);
    const rule = rules.find(
      (r) =>
        r.equals?.some((e) => slashless(e) === url) ||
        r.includes?.some((fragment) => url.includes(fragment)),
    );
    const { changefreq, priority } = rule ?? fallback;
    return { ...item, changefreq: changefreq as EnumChangefreq, priority };
  };
}
