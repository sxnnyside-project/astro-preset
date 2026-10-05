import { chmodSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { buildSiteFiles, type ScaffoldOptions } from './files';

/** Writes a new site into `dir`, which must not exist or must be empty. Returns the files written. */
export function writeSite(dir: string, options: ScaffoldOptions): string[] {
  if (existsSync(dir) && readdirSync(dir).length > 0) throw new Error(`${dir} is not empty`);
  const files = buildSiteFiles(options);
  for (const [rel, content] of Object.entries(files)) {
    const path = join(dir, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    if (rel.startsWith('.husky/')) chmodSync(path, 0o755);
  }
  return Object.keys(files).sort();
}
