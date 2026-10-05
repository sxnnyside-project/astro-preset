import { existsSync, readFileSync } from 'node:fs';
import {
  extractCspFromHeaders,
  parseCspDirectives,
  permitsExternal,
  permitsInline,
  sourcesFor,
} from './csp';
import { routeFromFile, walk } from './dist-walk';
import { extractInlineStyles, extractScripts, NON_EXECUTABLE_SCRIPT_TYPES } from './html';
import { finish } from './report';

export interface CspCheckOptions {
  dist: string;
  headers: string;
  /** Production origin, used to decide whether a same-origin script satisfies `'self'`. */
  site: string;
}

interface Violation {
  route: string;
  kind: 'external script' | 'inline script' | 'inline style';
  detail: string;
  why: string;
  suggest?: string | undefined;
}

const nonceOf = (attrs: string) => /nonce\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? null;

/**
 * Fails when the generated HTML runs a script or style that the declared `Content-Security-Policy`
 * (`public/_headers`, `/*` block) does not permit. It is solution-agnostic: it only asks whether
 * every executable script and style on every page is allowed by the policy as written.
 */
export function runCspCheck(options: CspCheckOptions): never {
  if (!existsSync(options.headers)) {
    console.error(`✗ ${options.headers} does not exist: a site must ship its headers.`);
    process.exit(1);
  }
  const csp = extractCspFromHeaders(readFileSync(options.headers, 'utf8'));
  if (!csp) {
    console.error(`✗ No Content-Security-Policy found for /* in ${options.headers}.`);
    process.exit(1);
  }
  if (!existsSync(options.dist)) {
    console.error(`✗ ${options.dist} does not exist: run the build first.`);
    process.exit(1);
  }

  const directives = parseCspDirectives(csp);
  const scriptSrc = sourcesFor(directives, 'script-src');
  const styleSrc = sourcesFor(directives, 'style-src');
  const violations: Violation[] = [];
  const counts = { inlineScripts: 0, externalScripts: 0, inlineStyles: 0 };

  const files = walk(options.dist, '.html');
  for (const file of files) {
    const html = readFileSync(file, 'utf8');
    const route = routeFromFile(options.dist, file);

    for (const s of extractScripts(html)) {
      if (NON_EXECUTABLE_SCRIPT_TYPES.has((s.type ?? '').toLowerCase())) continue;
      if (s.src) {
        counts.externalScripts++;
        const verdict = permitsExternal(scriptSrc, s.src, options.site);
        if (!verdict.ok)
          violations.push({ route, kind: 'external script', detail: s.src, why: verdict.why });
        continue;
      }
      if (!s.body.trim()) continue;
      counts.inlineScripts++;
      const verdict = permitsInline(scriptSrc, s.body, nonceOf(s.attrs));
      if (!verdict.ok) {
        violations.push({
          route,
          kind: 'inline script',
          detail: `${s.body.trim().length} bytes: ${s.body.trim().slice(0, 60).replace(/\s+/g, ' ')}…`,
          why: verdict.why,
          suggest: verdict.suggestHash,
        });
      }
    }

    for (const style of extractInlineStyles(html)) {
      if (!style.body.trim()) continue;
      counts.inlineStyles++;
      const verdict = permitsInline(styleSrc, style.body, nonceOf(style.attrs));
      if (!verdict.ok) {
        violations.push({
          route,
          kind: 'inline style',
          detail: `${style.body.trim().length} bytes`,
          why: verdict.why,
          suggest: verdict.suggestHash,
        });
      }
    }
  }

  console.log('CSP contract check');
  console.log(`  policy source    ${options.headers} (/*)`);
  console.log(`  script-src       ${scriptSrc.join(' ') || '(none)'}`);
  console.log(`  style-src        ${styleSrc.join(' ') || '(none)'}`);
  console.log(`  scanned          ${files.length} pages`);
  console.log(`  inline scripts   ${counts.inlineScripts}`);
  console.log(`  external scripts ${counts.externalScripts}`);
  console.log(`  inline styles    ${counts.inlineStyles}`);

  if (violations.length > 0) {
    console.error(`\n✗ ${violations.length} CSP contract violation(s):\n`);
    for (const v of violations.slice(0, 15)) {
      console.error(`  ${v.route}\n    ${v.kind}: ${v.detail}\n    ${v.why}`);
      if (v.suggest) console.error(`    would be permitted by: ${v.suggest}`);
      console.error('');
    }
    if (violations.length > 15) console.error(`  …and ${violations.length - 15} more.\n`);
    console.error(
      '  Fix it by making the emitted HTML and the declared policy agree: keep the execution\n  external, or widen the policy deliberately.',
    );
  }
  return finish({ title: 'CSP contract', failureCount: violations.length });
}
