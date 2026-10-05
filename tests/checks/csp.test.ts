import { describe, expect, test } from 'bun:test';
import {
  extractCspFromHeaders,
  hashesOf,
  parseCspDirectives,
  permitsExternal,
  permitsInline,
  sourcesFor,
} from '../../src/checks/csp/csp';

describe('parseCspDirectives / sourcesFor', () => {
  test('parses a multi-directive policy', () => {
    const d = parseCspDirectives(
      "default-src 'self'; script-src 'self' https://example.com; style-src 'self' 'unsafe-inline'",
    );
    expect(d.get('script-src')).toEqual(["'self'", 'https://example.com']);
    expect(d.get('style-src')).toEqual(["'self'", "'unsafe-inline'"]);
  });

  test('script-src falls back to default-src when absent', () => {
    const d = parseCspDirectives("default-src 'self' https://cdn.example.com");
    expect(sourcesFor(d, 'script-src')).toEqual(["'self'", 'https://cdn.example.com']);
  });
});

describe('permitsInline — CSP allows/blocks script', () => {
  test('CSP allows script: matching hash → PASS', () => {
    const body = 'console.log(1)';
    const sources = [hashesOf(body)[0]];
    expect(permitsInline(sources, body, null)).toEqual({ ok: true, via: 'hash' });
  });

  test('CSP blocks script: no hash/nonce/unsafe-inline → FAIL', () => {
    const result = permitsInline(["'self'"], 'console.log(1)', null);
    expect(result.ok).toBe(false);
  });

  test('CSP allows script: matching nonce → PASS', () => {
    const result = permitsInline(["'nonce-abc123'"], 'console.log(1)', 'abc123');
    expect(result).toEqual({ ok: true, via: 'nonce' });
  });

  test("CSP allows script: bare 'unsafe-inline' with no hash/nonce present → PASS", () => {
    const result = permitsInline(["'self'", "'unsafe-inline'"], 'console.log(1)', null);
    expect(result).toEqual({ ok: true, via: 'unsafe-inline' });
  });

  test("CSP blocks script: 'unsafe-inline' is ignored by browsers once a hash is also present", () => {
    const body = 'console.log(1)';
    const sources = ["'unsafe-inline'", hashesOf('something-else')[0]];
    const result = permitsInline(sources, body, null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.why).toMatch(/ignore/);
  });

  test('a hash for different content does not match', () => {
    const sources = [hashesOf('a different script')[0]];
    expect(permitsInline(sources, 'console.log(1)', null).ok).toBe(false);
  });
});

describe('permitsExternal', () => {
  const origin = 'https://www.sxnnysideproject.com';

  test('root-relative URL requires self', () => {
    expect(permitsExternal(["'self'"], '/_astro/foo.js', origin)).toEqual({ ok: true });
    expect(permitsExternal([], '/_astro/foo.js', origin).ok).toBe(false);
  });

  test('same-origin absolute URL requires self', () => {
    expect(permitsExternal(["'self'"], `${origin}/_astro/foo.js`, origin)).toEqual({ ok: true });
  });

  test('exact host match permits', () => {
    expect(
      permitsExternal(['https://www.youtube.com'], 'https://www.youtube.com/embed/x', origin),
    ).toEqual({ ok: true });
  });

  test('wildcard subdomain match permits', () => {
    expect(
      permitsExternal(['https://*.notion.so'], 'https://prod-files.notion.so/img.png', origin),
    ).toEqual({ ok: true });
  });

  test('unlisted host is blocked', () => {
    const result = permitsExternal(
      ['https://www.youtube.com'],
      'https://evil.example.com/x.js',
      origin,
    );
    expect(result.ok).toBe(false);
  });

  test('* permits any host', () => {
    expect(permitsExternal(['*'], 'https://anything.example.com/x.js', origin)).toEqual({
      ok: true,
    });
  });
});

describe('extractCspFromHeaders', () => {
  test('extracts the CSP declared under /* ', () => {
    const headers = `/*\n  Content-Security-Policy: default-src 'self'; script-src 'self'\n  X-Frame-Options: DENY\n`;
    expect(extractCspFromHeaders(headers)).toBe("default-src 'self'; script-src 'self'");
  });

  test('returns null when no CSP is declared for /*', () => {
    const headers = `/*\n  X-Frame-Options: DENY\n`;
    expect(extractCspFromHeaders(headers)).toBeNull();
  });

  test('ignores a CSP declared under an unrelated path pattern', () => {
    const headers = `/api/*\n  Content-Security-Policy: default-src 'none'\n`;
    expect(extractCspFromHeaders(headers)).toBeNull();
  });
});
