import { describe, it, expect } from 'vitest';
import { collectSourceFiles } from '@/lib/security-review';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * collectSourceFiles(dir) walks a REAL directory on disk and returns
 * SourceFile[] for scanForSecrets — skips node_modules/.git/.next so a
 * scan is fast and does not flag vendored code that isn't ours.
 */
describe('collectSourceFiles', () => {
  it('reads real files from disk, skipping node_modules/.git/.next', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-scan-'));
    try {
      fs.writeFileSync(path.join(dir, 'a.ts'), 'const x = 1;');
      fs.mkdirSync(path.join(dir, 'node_modules', 'pkg'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'node_modules', 'pkg', 'b.ts'), 'const secret = "AKIAABCDEFGHIJKLMNOP";');
      fs.mkdirSync(path.join(dir, '.git'), { recursive: true });
      fs.writeFileSync(path.join(dir, '.git', 'c.ts'), 'x');

      const files = collectSourceFiles(dir);
      const paths = files.map((f) => f.path);
      expect(paths.some((p) => p.endsWith('a.ts'))).toBe(true);
      expect(paths.some((p) => p.includes('node_modules'))).toBe(false);
      expect(paths.some((p) => p.includes('.git'))).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
