import { describe, expect, test } from 'bun:test';
import { sitemapFilter, sitemapSerialize } from '../src/sitemap';

const item = (url: string) =>
  ({ url }) as Parameters<NonNullable<ReturnType<typeof sitemapSerialize>>>[0];
const apply = (fn: ReturnType<typeof sitemapSerialize>, url: string) => {
  if (!fn) throw new Error('no serialize');
  return fn(item(url)) as { priority?: number; changefreq?: string };
};

describe('sitemapFilter', () => {
  const filter = sitemapFilter({ exclude: ['/private'], excludeExact: ['https://x.com/'] });
  test('drops error pages, extra fragments and exact URLs', () => {
    expect(filter('https://x.com/404/')).toBe(false);
    expect(filter('https://x.com/500/')).toBe(false);
    expect(filter('https://x.com/es/private/')).toBe(false);
    expect(filter('https://x.com/')).toBe(false);
    expect(filter('https://x.com')).toBe(false);
    expect(filter('https://x.com/es/')).toBe(true);
  });
});

describe('sitemapSerialize', () => {
  test('no rules, no serialize: the sitemap keeps its defaults', () => {
    expect(sitemapSerialize({})).toBeUndefined();
  });

  const serialize = sitemapSerialize({
    rules: [
      { equals: ['https://x.com/es', 'https://x.com/en'], changefreq: 'weekly', priority: 1 },
      { includes: ['/realms/'], changefreq: 'weekly', priority: 0.9 },
      { includes: ['/about', '/manifesto'], changefreq: 'monthly', priority: 0.7 },
    ],
  });

  test('matches on the slashless URL, so the trailingSlash contract does not matter', () => {
    expect(apply(serialize, 'https://x.com/es/')).toMatchObject({
      priority: 1,
      changefreq: 'weekly',
    });
    expect(apply(serialize, 'https://x.com/es')).toMatchObject({ priority: 1 });
  });

  test('first matching rule wins and the fallback applies to the rest', () => {
    expect(apply(serialize, 'https://x.com/es/realms/a/')).toMatchObject({ priority: 0.9 });
    expect(apply(serialize, 'https://x.com/es/about/')).toMatchObject({ priority: 0.7 });
    expect(apply(serialize, 'https://x.com/es/other/')).toMatchObject({
      priority: 0.5,
      changefreq: 'monthly',
    });
  });
});
