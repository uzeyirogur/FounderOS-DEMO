import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

vi.mock('@/lib/security-review', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/security-review')>();
  return { ...actual, runNpmAuditLive: vi.fn() };
});

import { runSecurityReview } from '@/lib/security-review-orchestrator';
import { runNpmAuditLive } from '@/lib/security-review';

/**
 * runSecurityReview(projectDir) runs BOTH real checks against a real
 * directory: npm audit (mocked here to avoid a slow real npm call in
 * unit tests — runNpmAuditLive itself is tested for real elsewhere) and
 * the secret scan (genuinely walks the temp dir on disk).
 */
describe('runSecurityReview', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-orch-'));
    fs.writeFileSync(path.join(dir, 'leak.ts'), 'const key = "AKIAABCDEFGHIJKLMNOP";');
    fs.writeFileSync(path.join(dir, 'clean.ts'), 'export const ok = 1;');
    (runNpmAuditLive as any).mockResolvedValue({ total: 2, info: 0, low: 0, moderate: 0, high: 1, critical: 1, ok: false });
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('combines the audit summary and secret findings into one honest report', async () => {
    const report = await runSecurityReview(dir);
    expect(report.audit?.ok).toBe(false);
    expect(report.audit?.critical).toBe(1);
    expect(report.secrets).toHaveLength(1);
    expect(report.secrets[0].pattern).toBe('aws-access-key');
    expect(report.ok).toBe(false); // any finding at all -> not ok
  });

  it('is ok only when both audit and secrets are clean', async () => {
    (runNpmAuditLive as any).mockResolvedValue({ total: 0, info: 0, low: 0, moderate: 0, high: 0, critical: 0, ok: true });
    fs.rmSync(path.join(dir, 'leak.ts'));
    const report = await runSecurityReview(dir);
    expect(report.ok).toBe(true);
  });

  it('is honest when npm audit itself could not run (null, not fabricated clean)', async () => {
    (runNpmAuditLive as any).mockResolvedValue(null);
    const report = await runSecurityReview(dir);
    expect(report.audit).toBeNull();
    expect(report.ok).toBe(false); // unknown audit state must never read as "ok"
  });
});
