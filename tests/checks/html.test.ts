import { describe, expect, test } from 'bun:test';
import {
  executableInlineScripts,
  extractAnchorHrefs,
  extractElementIds,
  extractFetchedResources,
  extractInlineStyles,
  extractJsonLdUrls,
  extractScriptSrcs,
  extractSeoMeta,
  extractStylesheetHrefs,
} from '../../src/checks/csp/html';

describe('extractSeoMeta', () => {
  test('extracts canonical, hreflang set, and noindex', () => {
    const html = `<link rel="canonical" href="https://x/es/about/">
      <link rel="alternate" hreflang="es" href="https://x/es/about/">
      <link rel="alternate" hreflang="en" href="https://x/en/about/">
      <link rel="alternate" hreflang="x-default" href="https://x/es/about/">`;
    const meta = extractSeoMeta(html);
    expect(meta.canonical).toBe('https://x/es/about/');
    expect(meta.hreflang.get('en')).toBe('https://x/en/about/');
    expect(meta.noindex).toBe(false);
  });

  test('detects noindex', () => {
    const html = `<meta name="robots" content="noindex"><link rel="canonical" href="https://x/es/">`;
    expect(extractSeoMeta(html).noindex).toBe(true);
  });

  test('no canonical tag → null', () => {
    expect(extractSeoMeta('<p>no seo meta here</p>').canonical).toBeNull();
  });
});

describe('executableInlineScripts', () => {
  test('finds an inline script with a body', () => {
    const html = '<script>console.log(1)</script>';
    expect(executableInlineScripts(html)).toHaveLength(1);
  });

  test('excludes JSON-LD and application/json data islands', () => {
    const html = `<script type="application/json">{"a":1}</script><script type="application/ld+json">{}</script>`;
    expect(executableInlineScripts(html)).toHaveLength(0);
  });

  test('excludes external scripts (has src)', () => {
    const html = '<script src="/foo.js"></script>';
    expect(executableInlineScripts(html)).toHaveLength(0);
  });

  test('excludes empty inline scripts', () => {
    expect(executableInlineScripts('<script></script>')).toHaveLength(0);
  });
});

describe('extractStylesheetHrefs / extractScriptSrcs', () => {
  test('extracts stylesheet hrefs, ignoring other link rels', () => {
    const html = `<link rel="stylesheet" href="/a.css"><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/b.css">`;
    expect(extractStylesheetHrefs(html)).toEqual(['/a.css', '/b.css']);
  });

  test('extracts external script srcs', () => {
    const html = `<script src="/a.js"></script><script>inline</script><script src="/b.js"></script>`;
    expect(extractScriptSrcs(html)).toEqual(['/a.js', '/b.js']);
  });
});

describe('extractInlineStyles', () => {
  test('extracts inline style bodies', () => {
    const html = '<style>.a{color:red}</style>';
    expect(extractInlineStyles(html)[0]?.body).toBe('.a{color:red}');
  });
});

describe('extractFetchedResources', () => {
  test('includes script/img/iframe, and link only for fetch-triggering rels', () => {
    const html = `
      <script src="/a.js"></script>
      <link rel="stylesheet" href="/a.css">
      <link rel="canonical" href="/self/">
      <img src="/x.png">
      <iframe src="https://youtube.com/embed/1"></iframe>`;
    const urls = extractFetchedResources(html).map((r) => r.url);
    expect(urls).toContain('/a.js');
    expect(urls).toContain('/a.css');
    expect(urls).toContain('/x.png');
    expect(urls).toContain('https://youtube.com/embed/1');
    expect(urls).not.toContain('/self/');
  });

  test('takes only the first URL from a srcset', () => {
    const html = `<img src="/x.png" srcset="/x-1x.png 1x, /x-2x.png 2x">`;
    const urls = extractFetchedResources(html).map((r) => r.url);
    expect(urls).toContain('/x-1x.png');
    expect(urls).not.toContain('/x-2x.png');
  });
});

describe('extractAnchorHrefs / extractElementIds', () => {
  test('extracts every <a href>', () => {
    const html = `<a href="/about/">About</a><a href="#section">Jump</a>`;
    expect(extractAnchorHrefs(html)).toEqual(['/about/', '#section']);
  });

  test('extracts every element id', () => {
    const html = `<div id="foo"></div><section id="bar"><span id="baz"></span></section>`;
    expect(extractElementIds(html)).toEqual(new Set(['foo', 'bar', 'baz']));
  });
});

describe('extractJsonLdUrls', () => {
  test('extracts and unescapes url/item values from ld+json blocks', () => {
    const html = `<script type="application/ld+json">{"@type":"WebPage","url":"https://x/es/about/","item":"https://x/es/"}</script>`;
    expect(extractJsonLdUrls(html).sort()).toEqual(['https://x/es/', 'https://x/es/about/']);
  });

  test('unescapes safeJsonLd-style \\u003c/\\u003e/\\u0026 sequences', () => {
    const html = `<script type="application/ld+json">{"url":"https://x/es/?a\\u0026b"}</script>`;
    expect(extractJsonLdUrls(html)).toEqual(['https://x/es/?a&b']);
  });
});
