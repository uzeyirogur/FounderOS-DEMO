import { describe, it, expect } from 'vitest';
import { runQaReview, type ExecFn } from '@/lib/qa-review-orchestrator';

/**
 * QA must pick its commands from the REAL project stack (Project
 * Registry / manifest detection), never hardcode npm — a .NET or Python
 * project registered in the Project Registry must get dotnet/pytest
 * commands, not a doomed `npm test` that always reports not_configured.
 */
describe('runQaReview — stack-aware command selection', () => {
  it('a Node project (package.json present) still runs npm scripts as before', async () => {
    const calls: string[] = [];
    const execFn: ExecFn = async (cmd, args) => {
      calls.push(`${cmd} ${args.join(' ')}`);
      if (cmd === 'npm' && args[0] === 'pkg') return { stdout: '', stderr: '', scripts: { test: 'vitest run', typecheck: 'tsc --noEmit', build: 'next build' } };
      if (cmd === 'npm' && args[0] === 'test') return { stdout: '{"numTotalTests":1,"numPassedTests":1,"numFailedTests":0,"testResults":[]}', stderr: '' };
      if (cmd === 'npm' && args[0] === 'run' && args[1] === 'typecheck') return { stdout: '', stderr: '' };
      if (cmd === 'npm' && args[0] === 'run' && args[1] === 'build') return { stdout: 'Compiled successfully', stderr: '' };
      throw new Error(`unexpected call: ${cmd} ${args.join(' ')}`);
    };
    const report = await runQaReview(execFn, '/fake/node-project', { languages: ['TypeScript/JavaScript'], frameworks: [], testRunners: ['Vitest'], checklist: [], note: '' });
    expect(report.ok).toBe(true);
    expect(calls[0]).toContain('npm pkg get scripts');
  });

  it('a .NET project (no package.json, .NET detected) runs dotnet build/test, never npm', async () => {
    const calls: string[] = [];
    const execFn: ExecFn = async (cmd, args) => {
      calls.push(`${cmd} ${args.join(' ')}`);
      if (cmd === 'dotnet' && args[0] === 'build') return { stdout: 'Build succeeded.', stderr: '' };
      if (cmd === 'dotnet' && args[0] === 'test') return { stdout: 'Passed!  - Failed: 0, Passed: 12, Skipped: 0, Total: 12', stderr: '' };
      throw new Error(`unexpected call for a .NET project: ${cmd} ${args.join(' ')}`);
    };
    const report = await runQaReview(execFn, '/fake/dotnet-project', { languages: ['.NET / C#'], frameworks: [], testRunners: [], checklist: [], note: '' });
    expect(calls.some((c) => c.startsWith('npm'))).toBe(false);
    expect(calls).toContain('dotnet build');
    expect(calls).toContain('dotnet test');
    expect(report.build.ok).toBe(true);
  });

  it('a .NET build failure is reported honestly, never as a false pass', async () => {
    const execFn: ExecFn = async (cmd, args) => {
      if (cmd === 'dotnet' && args[0] === 'build') throw new Error('error CS0246: type or namespace not found');
      throw new Error(`unexpected: ${cmd}`);
    };
    const report = await runQaReview(execFn, '/fake/dotnet-project', { languages: ['.NET / C#'], frameworks: [], testRunners: [], checklist: [], note: '' });
    expect(report.build.ok).toBe(false);
    expect(report.ok).toBe(false);
  });

  it('a Python project (pyproject.toml) runs pytest, never npm', async () => {
    const calls: string[] = [];
    const execFn: ExecFn = async (cmd, args) => {
      calls.push(`${cmd} ${args.join(' ')}`);
      if (cmd === 'python' && args[0] === '-m' && args[1] === 'pytest') return { stdout: '5 passed in 0.42s', stderr: '' };
      throw new Error(`unexpected call for a Python project: ${cmd} ${args.join(' ')}`);
    };
    const report = await runQaReview(execFn, '/fake/py-project', { languages: ['Python'], frameworks: [], testRunners: [], checklist: [], note: '' });
    expect(calls.some((c) => c.startsWith('npm'))).toBe(false);
    expect(calls).toContain('python -m pytest');
    // Python stack has no generic "build" concept in this detector — build
    // must be honestly not_configured, never a fabricated pass.
    expect(report.build.detail).toContain('not_configured');
  });

  it('an unrecognized stack (no manifest detected) is honestly not_configured across the board, never a fake pass', async () => {
    const execFn: ExecFn = async () => {
      throw new Error('should never be called for an unrecognized stack');
    };
    const report = await runQaReview(execFn, '/fake/empty-project', { languages: [], frameworks: [], testRunners: [], checklist: [], note: '' });
    expect(report.ok).toBe(false);
    expect(report.build.detail).toContain('not_configured');
  });

  it('omitting the stack report falls back to the legacy Node/npm-only behavior (back-compat)', async () => {
    const execFn: ExecFn = async (cmd, args) => {
      if (cmd === 'npm' && args[0] === 'pkg') return { stdout: '', stderr: '', scripts: {} };
      throw new Error(`unexpected: ${cmd}`);
    };
    const report = await runQaReview(execFn, '/fake/legacy-call-site');
    expect(report.build.detail).toContain('not_configured');
  });
});
