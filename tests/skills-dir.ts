import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * The sxnnyside-skills checkout, when there is one next to this repo (or `SXNNYSIDE_SKILLS_DIR`).
 * A few tests compare the preset's copies against the skill templates they came from; without the
 * checkout (CI, a fresh clone) they are skipped, the rest of the suite does not need it.
 */
const candidate =
  process.env.SXNNYSIDE_SKILLS_DIR ?? resolve(import.meta.dir, '..', '..', 'sxnnyside-skills');

export const skillsDir: string | null = existsSync(join(candidate, 'skills')) ? candidate : null;

export function skillPath(...parts: string[]): string {
  if (skillsDir === null) throw new Error('sxnnyside-skills checkout not found');
  return join(skillsDir, 'skills', ...parts);
}
