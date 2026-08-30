import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runQaReviewLive } from '@/lib/qa-review-orchestrator';

/**
 * Real bug found live during the go-live sprint's end-to-end project
 * lifecycle test: runQaReviewLive's execFile call did not set `env`, so
 * the spawned `npm run build`/`npm test`/`npm run typecheck` child
 * processes inherited the CALLING process's full environment — including
 * NODE_ENV. When FounderOS itself is running via `npm run dev`
 * (NODE_ENV=development, set by Next.js's dev CLI), a QA review
 * triggered through the running app spawned the TARGET project's
 * `next build` with NODE_ENV=development still set, which produced a
 * real, reproducible Next.js build failure ("<Html> should not be
 * imported outside of pages/_document", a documented Next.js dev/prod
 * env-mode confusion symptom) — confirmed reproducible even against a
 * fully independent node_modules copy, ruling out a shared-cache race.
 *
 * This test spawns a REAL child process (via runQaReviewLive's own
 * exported live wiring) against a REAL throwaway project directory,
 * asserting the child sees NODE_ENV=production for the build step
 * regardless of what NODE_ENV the test runner itself has.
 */
describe('runQaReviewLive — real environment isolation for the spawned build', () => {
  it('the spawned build sees NODE_ENV=production even when the calling process has NODE_ENV=development', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'qa-env-check-'));
    try {
      // Simulate exactly the failure condition: the calling process (this
      // test, standing in for FounderOS's own `npm run dev`) has
      // NODE_ENV=development set.
      vi.stubEnv('NODE_ENV', 'development');

      writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({
          name: 'qa-env-check',
          scripts: {
            // A "build" script that just echoes what NODE_ENV it actually
            // saw — a real child process, not a mock, proving the real
            // env passed to execFile.
            build: process.platform === 'win32' ? 'echo NODE_ENV_SEEN=%NODE_ENV%' : 'echo NODE_ENV_SEEN=$NODE_ENV',
          },
        }),
      );

      const report = await runQaReviewLive(dir);
      expect(report.build.ok).toBe(true);
      expect(report.build.detail).toContain('NODE_ENV_SEEN=production');
      expect(report.build.detail).not.toContain('NODE_ENV_SEEN=development');
    } finally {
      vi.unstubAllEnvs();
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);
});
