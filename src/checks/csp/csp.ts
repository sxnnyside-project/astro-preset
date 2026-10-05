/**
 * csp.ts
 * Pure CSP evaluation: parse a Content-Security-Policy string, and decide
 * whether it permits a given inline script/style or external resource load.
 *
 * Kept free of any filesystem/network I/O so it can be unit tested directly —
 * see csp.test.ts — independent of how the policy or the HTML was obtained.
 */

import { createHash } from 'node:crypto';

export type CspDirectives = Map<string, string[]>;

export function parseCspDirectives(csp: string): CspDirectives {
  const map: CspDirectives = new Map();
  for (const part of csp.split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    const [directive, ...values] = tokens;
    if (!directive) continue;
    map.set(directive.toLowerCase(), values);
  }
  return map;
}

/** script-src / style-src fall back to default-src, per the CSP spec. */
export function sourcesFor(directives: CspDirectives, name: string): string[] {
  return directives.get(name) ?? directives.get('default-src') ?? [];
}

/** Always exactly 3 hashes (sha256, sha384, sha512), in that order. */
export function hashesOf(body: string): [string, string, string] {
  const [sha256, sha384, sha512] = ['sha256', 'sha384', 'sha512'].map(
    (algo) => `'${algo}-${createHash(algo).update(body, 'utf8').digest('base64')}'`,
  );
  return [sha256 ?? '', sha384 ?? '', sha512 ?? ''];
}

export type InlineVerdict =
  | { ok: true; via: 'nonce' | 'hash' | 'unsafe-inline' }
  | { ok: false; why: string; suggestHash: string };

/**
 * Decide whether a policy permits one inline script/style block, the way a
 * browser actually resolves it: a hash or nonce match wins outright;
 * 'unsafe-inline' only works when the directive carries NO hash or nonce
 * source at all (browsers silently ignore 'unsafe-inline' the moment a hash
 * or nonce is present in the same directive — a common and easy-to-miss
 * CSP-spec detail this function encodes so nothing else has to remember it).
 */
export function permitsInline(
  sources: string[],
  body: string,
  nonce: string | null,
): InlineVerdict {
  const hasHashOrNonce = sources.some((s) => /^'(sha(256|384|512)-|nonce-)/.test(s));

  if (nonce && sources.includes(`'nonce-${nonce}'`)) return { ok: true, via: 'nonce' };

  const candidates = hashesOf(body);
  const match = candidates.find((h) => sources.includes(h));
  if (match) return { ok: true, via: 'hash' };

  if (sources.includes("'unsafe-inline'") && !hasHashOrNonce)
    return { ok: true, via: 'unsafe-inline' };
  if (sources.includes("'unsafe-inline'") && hasHashOrNonce) {
    return {
      ok: false,
      why: "'unsafe-inline' is present but the directive also carries a hash or nonce, which makes browsers ignore it",
      suggestHash: candidates[0],
    };
  }
  return {
    ok: false,
    why: "no matching hash, no nonce, no usable 'unsafe-inline'",
    suggestHash: candidates[0],
  };
}

export type ExternalVerdict = { ok: true } | { ok: false; why: string };

/** Whether an external (or root-relative) URL is permitted by a source list. */
export function permitsExternal(
  sources: string[],
  url: string,
  pageOrigin: string,
): ExternalVerdict {
  if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
    return sources.includes("'self'")
      ? { ok: true }
      : { ok: false, why: `root-relative URL not permitted; 'self' missing from sources` };
  }
  let parsed: URL;
  try {
    parsed = new URL(url, pageOrigin);
  } catch {
    return { ok: true }; // data:/blob: and malformed URLs are out of this function's scope
  }
  const originUrl = new URL(pageOrigin);
  if (parsed.origin === originUrl.origin) {
    return sources.includes("'self'")
      ? { ok: true }
      : { ok: false, why: `same-origin URL not permitted; 'self' missing from sources` };
  }
  const permitted = sources.some((s) => {
    if (s === '*') return true;
    if (s.startsWith("'")) return false;
    if (s.startsWith('https://') || s.startsWith('http://')) {
      const host = s.replace(/^https?:\/\//, '');
      return host.startsWith('*.') ? parsed.hostname.endsWith(host.slice(1)) : parsed.host === host;
    }
    return false;
  });
  return permitted
    ? { ok: true }
    : { ok: false, why: `${parsed.host} not permitted by any source` };
}

/** Extract the CSP that applies to `/*` (or `/`) from a Cloudflare Pages `_headers` file. */
export function extractCspFromHeaders(headersText: string): string | null {
  let currentPattern: string | null = null;
  for (const raw of headersText.split('\n')) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      currentPattern = raw.trim();
      continue;
    }
    const idx = raw.indexOf(':');
    if (idx < 0) continue;
    const name = raw.slice(0, idx).trim().toLowerCase();
    if (name === 'content-security-policy' && (currentPattern === '/*' || currentPattern === '/')) {
      return raw.slice(idx + 1).trim();
    }
  }
  return null;
}
