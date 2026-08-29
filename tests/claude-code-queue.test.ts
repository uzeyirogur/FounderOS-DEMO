import { describe, it, expect, vi } from 'vitest';
import { dispatchClaudeCode, buildDispatchPrompt } from '@/lib/claude-code-dispatch';
import { openDb } from '@/lib/db';
import { queueClaudeCodeRun, executeQueuedRun } from '@/lib/claude-code-queue';

/**
 * Overnight plan's "dry-run / queue / approval / run history" hardening
 * for the Claude Code Orchestrator — all reachable without spending real
 * money, so a real dispatch can be exercised from a single point once the
 * operator gives the go-ahead.
 */
describe('dispatchClaudeCode — dry run', () => {
  it('never calls execFn when dryRun is true, and returns the exact command that would run', async () => {
    const execFn = vi.fn();
    const result = await dispatchClaudeCode(execFn, {
      projectDir: '/tmp/proj',
      prompt: 'fix the bug',
      permissionLevel: 'auto_safe_write',
      dryRun: true,
    });
    expect(execFn).not.toHaveBeenCalled();
    if (!result.ok) throw new Error('expected dry run to report ok:true (a plan, not an error)');
    expect(result.dryRun).toBe(true);
    expect(result.result).toContain('fix the bug');
  });

  it('a dry run for a read_only project shows the restricted tool set, never claims write access', async () => {
    const execFn = vi.fn();
    const result = await dispatchClaudeCode(execFn, { projectDir: '/tmp/proj', prompt: 'x', permissionLevel: 'read_only', dryRun: true });
    if (!result.ok) throw new Error('expected dry run to report ok:true (a plan, not an error)');
    if (!result.dryRun) throw new Error('expected a dry run result');
    expect(result.allowedTools).not.toContain('Write');
  });
});

describe('buildDispatchPrompt', () => {
  it('wraps the raw goal with real project context — stack and lifecycle phase, never fabricated', () => {
    const prompt = buildDispatchPrompt({
      goal: 'Add a login page',
      stackNote: 'Detected from manifest files on disk: TypeScript/JavaScript.',
      lifecyclePhase: 'implementation',
    });
    expect(prompt).toContain('Add a login page');
    expect(prompt).toContain('TypeScript/JavaScript');
    expect(prompt).toContain('implementation');
  });

  it('omits context lines that are not available rather than inventing placeholders', () => {
    const prompt = buildDispatchPrompt({ goal: 'Add a login page' });
    expect(prompt).toContain('Add a login page');
    expect(prompt).not.toMatch(/undefined|null/i);
  });
});

describe('claude-code-queue — real run history', () => {
  it('queueClaudeCodeRun creates a real queued row, never dispatches immediately', () => {
    const db = openDb(':memory:');
    const run = queueClaudeCodeRun(db, { projectId: 'proj-1', projectDir: '/tmp/proj', prompt: 'fix it', permissionLevel: 'auto_safe_write' });
    expect(run.status).toBe('queued');
    expect(db.claudeCodeRuns.byId(run.id)?.status).toBe('queued');
  });

  it('executeQueuedRun runs the real dispatch and records the result in history', async () => {
    const db = openDb(':memory:');
    const run = queueClaudeCodeRun(db, { projectId: 'proj-1', projectDir: '/tmp/proj', prompt: 'fix it', permissionLevel: 'auto_safe_write' });
    const execFn = vi.fn().mockResolvedValue({
      stdout: JSON.stringify({ type: 'result', subtype: 'success', result: 'done', session_id: 's1', num_turns: 2, total_cost_usd: 0.01 }),
      stderr: '',
    });
    const updated = await executeQueuedRun(db, run.id, execFn);
    expect(updated.status).toBe('done');
    expect(updated.resultSummary).toBe('done');
    expect(db.claudeCodeRuns.byId(run.id)?.status).toBe('done');
  });

  it('a failed real dispatch is recorded as failed, never silently dropped', async () => {
    const db = openDb(':memory:');
    const run = queueClaudeCodeRun(db, { projectId: 'proj-1', projectDir: '/tmp/proj', prompt: 'fix it', permissionLevel: 'auto_safe_write' });
    const execFn = vi.fn().mockRejectedValue(new Error('claude: not found'));
    const updated = await executeQueuedRun(db, run.id, execFn);
    expect(updated.status).toBe('failed');
    expect(updated.error).toMatch(/not found/);
  });

  it('full_with_approval-tier runs are queued as awaiting_approval, not executable until approved', () => {
    const db = openDb(':memory:');
    const run = queueClaudeCodeRun(db, { projectId: 'proj-1', projectDir: '/tmp/proj', prompt: 'refactor everything', permissionLevel: 'full_with_approval' });
    expect(run.status).toBe('awaiting_approval');
  });

  it('executeQueuedRun refuses to run an awaiting_approval row', async () => {
    const db = openDb(':memory:');
    const run = queueClaudeCodeRun(db, { projectId: 'proj-1', projectDir: '/tmp/proj', prompt: 'refactor everything', permissionLevel: 'full_with_approval' });
    const execFn = vi.fn();
    await expect(executeQueuedRun(db, run.id, execFn)).rejects.toThrow(/approval/i);
    expect(execFn).not.toHaveBeenCalled();
  });

  it('a successful run triggers a real post-run QA handoff and records the report on the row', async () => {
    const db = openDb(':memory:');
    const run = queueClaudeCodeRun(db, { projectId: 'proj-1', projectDir: '/tmp/proj', prompt: 'fix it', permissionLevel: 'auto_safe_write' });
    const execFn = vi.fn().mockResolvedValue({
      stdout: JSON.stringify({ type: 'result', subtype: 'success', result: 'done', session_id: 's1', num_turns: 2, total_cost_usd: 0.01 }),
      stderr: '',
    });
    const qaFn = vi.fn().mockResolvedValue({ test: { total: 10, passed: 10, failed: 0, failedFiles: [] }, typecheck: { errorCount: 0, ok: true }, build: { ok: true, detail: 'ok' }, ok: true });
    const updated = await executeQueuedRun(db, run.id, execFn, qaFn);
    expect(qaFn).toHaveBeenCalledWith('/tmp/proj');
    expect(updated.qaReport).toBeTruthy();
    const parsed = JSON.parse(updated.qaReport!);
    expect(parsed.ok).toBe(true);
    expect(db.claudeCodeRuns.byId(run.id)?.qaReport).toBeTruthy();
  });

  it('a real QA failure after a successful dispatch does not overwrite the dispatch success, but is visible on the row', async () => {
    const db = openDb(':memory:');
    const run = queueClaudeCodeRun(db, { projectId: 'proj-1', projectDir: '/tmp/proj', prompt: 'fix it', permissionLevel: 'auto_safe_write' });
    const execFn = vi.fn().mockResolvedValue({
      stdout: JSON.stringify({ type: 'result', subtype: 'success', result: 'done', session_id: 's1', num_turns: 2, total_cost_usd: 0.01 }),
      stderr: '',
    });
    const qaFn = vi.fn().mockResolvedValue({ test: { total: 10, passed: 8, failed: 2, failedFiles: ['x.test.ts'] }, typecheck: { errorCount: 0, ok: true }, build: { ok: true, detail: 'ok' }, ok: false });
    const updated = await executeQueuedRun(db, run.id, execFn, qaFn);
    expect(updated.status).toBe('done');
    const parsed = JSON.parse(updated.qaReport!);
    expect(parsed.ok).toBe(false);
    expect(parsed.test.failed).toBe(2);
  });

  it('QA handoff is skipped (never run) when the dispatch itself failed — no wasted QA on a failed run', async () => {
    const db = openDb(':memory:');
    const run = queueClaudeCodeRun(db, { projectId: 'proj-1', projectDir: '/tmp/proj', prompt: 'fix it', permissionLevel: 'auto_safe_write' });
    const execFn = vi.fn().mockRejectedValue(new Error('claude: not found'));
    const qaFn = vi.fn();
    const updated = await executeQueuedRun(db, run.id, execFn, qaFn);
    expect(updated.status).toBe('failed');
    expect(qaFn).not.toHaveBeenCalled();
    expect(updated.qaReport).toBeNull();
  });

  it('a QA runner that itself throws is recorded honestly, never silently dropped or faked as passing', async () => {
    const db = openDb(':memory:');
    const run = queueClaudeCodeRun(db, { projectId: 'proj-1', projectDir: '/tmp/proj', prompt: 'fix it', permissionLevel: 'auto_safe_write' });
    const execFn = vi.fn().mockResolvedValue({
      stdout: JSON.stringify({ type: 'result', subtype: 'success', result: 'done', session_id: 's1', num_turns: 2, total_cost_usd: 0.01 }),
      stderr: '',
    });
    const qaFn = vi.fn().mockRejectedValue(new Error('npm test crashed'));
    const updated = await executeQueuedRun(db, run.id, execFn, qaFn);
    expect(updated.status).toBe('done');
    const parsed = JSON.parse(updated.qaReport!);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatch(/npm test crashed/);
  });
});
