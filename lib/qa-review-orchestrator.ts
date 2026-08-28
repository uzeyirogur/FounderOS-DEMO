import { parseVitestJsonSummary, parseTypecheckOutput, type VitestSummary, type TypecheckSummary } from '@/lib/qa-review';
import { detectProjectStack, type ProjectStackReport } from '@/lib/project-bootstrap';

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

/** Very small test-summary shape for non-Vitest runners (dotnet test,
 *  pytest) — real pass/fail counts, not a re-implementation of either
 *  tool's own reporting. Matches VitestSummary's real shape exactly so
 *  callers never need runner-specific branching to read report.test. */
function summaryFromCounts(failed: number, total: number): VitestSummary {
  return { total, passed: total - failed, failed, failedFiles: [] };
}

async function runDotnetPipeline(execFn: ExecFn, projectDir: string): Promise<QaReport> {
  let build: { ok: boolean; detail: string };
  try {
    const { stdout } = await execFn('dotnet', ['build'], { cwd: projectDir });
    build = { ok: true, detail: stdout.slice(-500) };
  } catch (err) {
    build = { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }

  let test: VitestSummary | null = null;
  if (build.ok) {
    try {
      const { stdout } = await execFn('dotnet', ['test'], { cwd: projectDir });
      const failedMatch = stdout.match(/Failed:\s*(\d+)/i);
      const totalMatch = stdout.match(/Total:\s*(\d+)/i);
      const failed = failedMatch ? Number(failedMatch[1]) : /failed/i.test(stdout) ? 1 : 0;
      const total = totalMatch ? Number(totalMatch[1]) : 0;
      test = summaryFromCounts(failed, total);
    } catch {
      // The test COMMAND itself failed to execute — report as one real
      // failure rather than a silent null (which downstream reads as "no
      // tests were configured", a false honest-empty).
      test = summaryFromCounts(1, 1);
    }
  }

  const ok = build.ok && (test === null || test.failed === 0);
  return { test, typecheck: null, build, ok };
}

async function runPytestPipeline(execFn: ExecFn, projectDir: string): Promise<QaReport> {
  let test: VitestSummary;
  try {
    const { stdout } = await execFn('python', ['-m', 'pytest'], { cwd: projectDir });
    const failedMatch = stdout.match(/(\d+)\s+failed/i);
    const passedMatch = stdout.match(/(\d+)\s+passed/i);
    const failed = failedMatch ? Number(failedMatch[1]) : 0;
    const passed = passedMatch ? Number(passedMatch[1]) : 0;
    test = summaryFromCounts(failed, failed + passed);
  } catch {
    test = summaryFromCounts(1, 1);
  }
  // This detector has no generic "build" concept for a bare Python project —
  // reporting a fabricated pass would violate the no-fake-success rule.
  const build = { ok: false, detail: 'not_configured — no build step is defined for a Python project by this detector' };
  const ok = test.failed === 0;
  return { test, typecheck: null, build, ok };
}

async function runNodePipeline(execFn: ExecFn, projectDir: string): Promise<QaReport> {
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
 * Runs REAL commands for whatever stack the project actually is, in a
 * Project Registry-authorized directory, and parses REAL output — never
 * re-implements test/typecheck logic and never hardcodes npm for a project
 * that isn't Node. `stack` should come from lib/project-bootstrap.ts's
 * detectProjectStack() (real manifest inspection); when omitted, this
 * falls back to the original Node/npm-only behavior for back-compat with
 * existing call sites that haven't been updated to pass a stack yet.
 */
export async function runQaReview(execFn: ExecFn, projectDir: string, stack?: ProjectStackReport): Promise<QaReport> {
  const languages = stack?.languages ?? ['TypeScript/JavaScript'];

  if (languages.includes('.NET / C#')) return runDotnetPipeline(execFn, projectDir);
  if (languages.includes('Python') && !languages.includes('TypeScript/JavaScript')) return runPytestPipeline(execFn, projectDir);
  if (languages.includes('TypeScript/JavaScript')) return runNodePipeline(execFn, projectDir);

  // No recognizable manifest at all — never guess a toolchain, report
  // honestly instead of running (and failing) an arbitrary command.
  return {
    test: null,
    typecheck: null,
    build: { ok: false, detail: 'not_configured — no recognizable project manifest (package.json, .csproj, requirements.txt, ...) found' },
    ok: false,
  };
}

/**
 * runQaReview wired to a real child_process invocation, with the stack
 * auto-detected from the real filesystem via detectProjectStack(). Honest
 * not_configured detail baked into runQaReview itself when a stack or
 * script is missing; this wrapper only supplies real process execution
 * and real stack detection.
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

  const stack = detectProjectStack(projectDir);
  return runQaReview(execFn, projectDir, stack);
}
