import { describe, it, expect, vi } from 'vitest';
import { runQaReview } from '@/lib/qa-review-orchestrator';

/**
 * runQaReview(execFn, projectDir) — runs REAL npm scripts (test,
 * typecheck, build) in a Project Registry-authorized directory and
 * parses the REAL output via lib/qa-review.ts's existing parsers. Never
 * re-implements test/typecheck logic. A script missing from the target's
 * package.json is reported honestly as not_configured for that check —
 * never silently skipped as if it passed.
 */
describe('runQaReview', () => {
  it('parses real green test/typecheck/build output as ok', async () => {
    const execFn = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '{}', stderr: '', scripts: { test: 'vitest run', typecheck: 'tsc --noEmit', build: 'next build' } })
      .mockResolvedValueOnce({
        stdout: JSON.stringify({ numTotalTests: 10, numPassedTests: 10, numFailedTests: 0, testResults: [] }),
        stderr: '',
      })
      .mockResolvedValueOnce({ stdout: '', stderr: '' })
      .mockResolvedValueOnce({ stdout: 'Compiled successfully', stderr: '' });
    const report = await runQaReview(execFn as any, '/tmp/proj');
    expect(report.test?.failed).toBe(0);
    expect(report.typecheck?.ok).toBe(true);
    expect(report.build.ok).toBe(true);
    expect(report.ok).toBe(true);
  });

  it('is honest when tests actually fail — never reports ok', async () => {
    const execFn = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '{}', stderr: '', scripts: { test: 'vitest run', typecheck: 'tsc --noEmit', build: 'next build' } })
      .mockResolvedValueOnce({
        stdout: JSON.stringify({ numTotalTests: 10, numPassedTests: 8, numFailedTests: 2, testResults: [{ name: 'a.test.ts', status: 'failed' }] }),
        stderr: '',
      })
      .mockResolvedValueOnce({ stdout: '', stderr: '' })
      .mockResolvedValueOnce({ stdout: 'Compiled successfully', stderr: '' });
    const report = await runQaReview(execFn as any, '/tmp/proj');
    expect(report.test?.failed).toBe(2);
    expect(report.ok).toBe(false);
  });

  it('reports build failure honestly from a real thrown error, never fabricates success', async () => {
    const execFn = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '{}', stderr: '', scripts: { test: 'vitest run', typecheck: 'tsc --noEmit', build: 'next build' } })
      .mockResolvedValueOnce({ stdout: JSON.stringify({ numTotalTests: 1, numPassedTests: 1, numFailedTests: 0, testResults: [] }), stderr: '' })
      .mockResolvedValueOnce({ stdout: '', stderr: '' })
      .mockRejectedValueOnce(new Error('Build failed with 1 error'));
    const report = await runQaReview(execFn as any, '/tmp/proj');
    expect(report.build.ok).toBe(false);
    expect(report.build.detail).toMatch(/Build failed/);
    expect(report.ok).toBe(false);
  });

  it('reports not_configured honestly when the target has no build script — never skips silently as pass', async () => {
    const execFn = vi.fn().mockResolvedValueOnce({ stdout: '{}', stderr: '', scripts: { test: 'vitest run' } });
    const report = await runQaReview(execFn as any, '/tmp/proj');
    expect(report.build.ok).toBe(false);
    expect(report.build.detail).toMatch(/not_configured/i);
    expect(report.typecheck).toBeNull();
  });

  it('when the typecheck COMMAND itself fails to run (e.g. spawn ENOENT), never reports ok:true — this is the exact bug caught in live verification: an exec failure fed through the TS-error-line parser produces a false "0 errors" positive', async () => {
    const execFn = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '{}', stderr: '', scripts: { typecheck: 'tsc --noEmit', build: 'next build' } })
      .mockRejectedValueOnce(new Error('spawn npm ENOENT'))
      .mockResolvedValueOnce({ stdout: 'Compiled successfully', stderr: '' });
    const report = await runQaReview(execFn as any, '/tmp/proj');
    expect(report.typecheck?.ok).toBe(false);
    expect(report.typecheck?.executionFailed).toBe(true);
    expect(report.ok).toBe(false);
  });

  it('when the build COMMAND itself fails to run, never reports a false pass from an unrelated real error message', async () => {
    const execFn = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '{}', stderr: '', scripts: { build: 'next build' } })
      .mockRejectedValueOnce(new Error('spawn npm ENOENT'));
    const report = await runQaReview(execFn as any, '/tmp/proj');
    expect(report.build.ok).toBe(false);
    expect(report.build.detail).toMatch(/ENOENT/);
    expect(report.ok).toBe(false);
  });
});
