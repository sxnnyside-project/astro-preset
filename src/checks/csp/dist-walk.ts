import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/** Every file under `dir` (optionally only those ending in `ext`), depth first. */
export function walk(dir: string, ext?: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, ext));
    else if (!ext || full.endsWith(ext)) out.push(full);
  }
  return out;
}

/** The route a `dist/` file is served at (`dist/es/index.html` -> `/es/`). */
export function routeFromFile(dist: string, file: string): string {
  return `/${path.relative(dist, file)}`.replace(/index\.html$/, '').replace(/\.html$/, '') || '/';
}
