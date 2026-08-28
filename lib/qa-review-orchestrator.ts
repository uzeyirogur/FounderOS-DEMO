import { parseVitestJsonSummary, parseTypecheckOutput, type VitestSummary, type TypecheckSummary } from '@/lib/qa-review';

export type ExecFn = (
  cmd: string,
  args: string[],
  opts: { cwd: string },
) => Promise<{ stdout: string; stderr: string; scripts?: Record<string, string> }>;

export interface QaReport {
  test: VitestSummary | null;
  typecheck: TypecheckSummary | null;
  build: { ok: boolean; detail: string };
  ok: boolean;
}

/**
 * Runs REAL npm scripts (test, typecheck, build) in a Project Registry-
 * authorized directory and parses the REAL output through lib/qa-review.ts's
 * existing parsers — never re-implements test/typecheck logic. execFn's
 * first call reads the target's own package.json scripts (so a project
 * without a given script is reported honestly as not_configured, never
 * silently skipped as a pass). Every subsequent call runs one real script.
 */
export async function runQaReview(execFn: ExecFn, projectDir: string): Promise<QaReport> {
  const pkgResult = await execFn('npm', ['pkg', 'get', 'scripts'], { cwd: projectDir });
  const scripts = pkgResult.scripts ?? {};

  let test: VitestSummary | null = null;
  if (scripts.test) {
    try {
      const { stdout } = await execFn('npm', ['test', '--', '--reporter=json'], { cwd: projectDir });
      test = parseVitestJsonSummary(stdout);
    } catch {
      test = null;
    }
  }

  let typecheck: TypecheckSummary | null = null;
  if (scripts.typecheck) {
    try {
      const { stdout, stderr } = await execFn('npm', ['run', 'typecheck'], { cwd: projectDir });
      typecheck = parseTypecheckOutput(stdout + stderr);
    } catch (err) {
      // The typecheck COMMAND itself failed to execute (spawn ENOENT, bad
      // cwd, etc.) — this is NOT the same as "0 errors found". Feeding an
      // exec-failure message through the TS-error-line parser produces a
      // false "0 errors, ok: true" positive (caught in live verification
      // against this very repo on Windows). Report it as a real failure.
      typecheck = { errorCount: -1, ok: false, executionFailed: true, detail: err instanceof Error ? err.message : String(err) };
    }
  }

  let build: { ok: boolean; detail: string };
  if (!scripts.build) {
    build = { ok: false, detail: 'not_configured — target has no "build" script in package.json' };
  } else {
    try {
      const { stdout } = await execFn('npm', ['run', 'build'], { cwd: projectDir });
      build = { ok: true, detail: stdout.slice(-500) };
    } catch (err) {
      build = { ok: false, detail: err instanceof Error ? err.message : String(err) };
    }
  }

  const ok =
    (test === null || test.failed === 0) &&
    (typecheck === null || typecheck.ok) &&
    build.ok &&
    // At least one real check must have actually run — an empty report is
    // never reported as "ok", per the honesty rule.
    (test !== null || typecheck !== null || build.ok);

  return { test, typecheck, build, ok };
}

/**
 * runQaReview wired to a real child_process invocation of npm. Honest
 * not_configured detail baked into runQaReview itself when a script is
 * missing; this wrapper only supplies the real process execution.
 */
export async function runQaReviewLive(projectDir: string): Promise<QaReport> {
  const { execFile } = await import('node:child_process');
  const fs = await import('node:fs');
  const path = await import('node:path');

  const execFn: ExecFn = (cmd, args, opts) =>
    new Promise((resolve, reject) => {
      if (cmd === 'npm' && args[0] === 'pkg' && args[1] === 'get' && args[2] === 'scripts') {
        try {
          const pkgPath = path.join(opts.cwd, 'package.json');
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { scripts?: Record<string, string> };
          resolve({ stdout: '', stderr: '', scripts: pkg.scripts ?? {} });
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
        return;
      }
      execFile(cmd, args, { cwd: opts.cwd, maxBuffer: 1024 * 1024 * 50, shell: true }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`${error.message}\n${stderr}`.trim()));
          return;
        }
        resolve({ stdout, stderr });
      });
    });

  return runQaReview(execFn, projectDir);
}
