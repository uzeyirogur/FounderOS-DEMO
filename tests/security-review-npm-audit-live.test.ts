import { describe, it, expect } from 'vitest';
import { runNpmAuditLive } from '@/lib/security-review';

/**
 * runNpmAuditLive(cwd) — a REAL child_process invocation of `npm audit
 * --json`, not mocked. security-review-orchestrator.test.ts's own comment
 * claimed this was "tested for real elsewhere" — it was not; grepping the
 * whole tests/ tree found zero real (non-mocked) invocations. Found live
 * during the V1 completion sprint's security final check: on Windows,
 * execFile('npm', ...) without `shell: true` resolves nothing (npm is a
 * .cmd shim, not a directly-executable binary) and the callback fires with
 * no stdout, which parseNpmAuditJson correctly turns into `null` — but a
 * silent null looks identical to "npm is missing", not "audit ran and
 * found nothing", so this was invisibly broken on every Windows dev
 * machine running this security check for real.
 */
describe('runNpmAuditLive — real npm audit --json invocation', () => {
  it('returns a real, parsed audit summary against this actual repo, not null', async () => {
    const result = await runNpmAuditLive(process.cwd());
    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      total: expect.any(Number),
      ok: expect.any(Boolean),
    });
  }, 30_000);

  it('returns null (honest failure) for a directory with no package.json', async () => {
    const os = await import('node:os');
    const fs = await import('node:fs');
    const path = await import('node:path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'npm-audit-no-pkg-'));
    try {
      const result = await runNpmAuditLive(dir);
      expect(result).toBeNull();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);
});
