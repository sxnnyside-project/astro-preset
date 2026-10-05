import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { routeFromFile, walk } from '../src/checks/csp/dist-walk';

describe('dist-walk', () => {
  test('lists files recursively and maps them to routes', () => {
    const dist = mkdtempSync(join(tmpdir(), 'dist-'));
    try {
      mkdirSync(join(dist, 'es', 'about'), { recursive: true });
      writeFileSync(join(dist, 'index.html'), '');
      writeFileSync(join(dist, 'es', 'index.html'), '');
      writeFileSync(join(dist, 'es', 'about', 'index.html'), '');
      writeFileSync(join(dist, 'app.css'), '');
      const html = walk(dist, '.html').map((f) => routeFromFile(dist, f));
      expect(html.sort()).toEqual(['/', '/es/', '/es/about/']);
      expect(walk(dist)).toHaveLength(4);
    } finally {
      rmSync(dist, { recursive: true, force: true });
    }
  });
});
