export interface HeadersOptions {
  /** Extra `connect-src` origins (APIs the site calls from the browser). */
  connectSrc?: readonly string[];
  /** Extra `frame-src` origins (embeds). */
  frameSrc?: readonly string[];
}

const SELF_ONLY = "'self'";

function csp(options: HeadersOptions): string {
  const connect = [SELF_ONLY, ...(options.connectSrc ?? [])].join(' ');
  const parts = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    `connect-src ${connect}`,
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ];
  if (options.frameSrc?.length) parts.splice(9, 0, `frame-src ${options.frameSrc.join(' ')}`);
  return parts.join('; ');
}

/** The contents of `public/_headers` for Cloudflare Pages: strict CSP, no inline scripts. */
export function sxnnysideHeaders(options: HeadersOptions = {}): string {
  return `/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  Cross-Origin-Opener-Policy: same-origin
  Content-Security-Policy: ${csp(options)}

/_astro/*
  Cache-Control: public, max-age=31536000, immutable

/fonts/*
  Cache-Control: public, max-age=31536000, immutable
`;
}
