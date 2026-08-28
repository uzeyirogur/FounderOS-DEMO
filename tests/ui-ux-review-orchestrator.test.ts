import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runUiUxReview } from '@/lib/ui-ux-review-orchestrator';

describe('runUiUxReview', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uiux-orch-'));
    fs.mkdirSync(path.join(dir, 'components'));
    fs.writeFileSync(path.join(dir, 'components', 'Bad.tsx'), '<img src="x.png" />\n<button onClick={x}><Trash /></button>');
    fs.writeFileSync(path.join(dir, 'components', 'Good.tsx'), 'export const ok = 1;');
    fs.mkdirSync(path.join(dir, 'node_modules', 'pkg'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'node_modules', 'pkg', 'Vendored.tsx'), '<img src="y.png" />');
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('finds real defects in the real directory, skipping node_modules', () => {
    const report = runUiUxReview(dir);
    expect(report.findings.length).toBe(2);
    expect(report.findings.every((f) => !f.path.includes('node_modules'))).toBe(true);
    expect(report.ok).toBe(false);
  });

  it('is ok when nothing is flagged', () => {
    fs.rmSync(path.join(dir, 'components', 'Bad.tsx'));
    const report = runUiUxReview(dir);
    expect(report.ok).toBe(true);
    expect(report.findings).toEqual([]);
  });
});
