import { randomUUID } from 'node:crypto';
import type { openDb } from '@/lib/db';
import type { ClaudeCodeRun } from '@/lib/schemas';
import { dispatchClaudeCode, type ExecFn } from '@/lib/claude-code-dispatch';

type Db = ReturnType<typeof openDb>;

export interface QueueRunInput {
  projectId: string;
  projectDir: string;
  prompt: string;
  permissionLevel: 'read_only' | 'auto_safe_write' | 'full_with_approval';
}

/**
 * Queues a real Claude Code run — never dispatches immediately. A
 * full_with_approval-tier request starts 'awaiting_approval' (the highest-
 * autonomy tier is the one the Approval Policy cares most about) and
 * cannot be executed until an operator approves it via the run's status;
 * read_only/auto_safe_write requests start 'queued' and are immediately
 * runnable through executeQueuedRun.
 */
export function queueClaudeCodeRun(db: Db, input: QueueRunInput): ClaudeCodeRun {
  const run: ClaudeCodeRun = {
    id: randomUUID(),
    projectId: input.projectId,
    projectDir: input.projectDir,
    prompt: input.prompt,
    permissionLevel: input.permissionLevel,
    status: input.permissionLevel === 'full_with_approval' ? 'awaiting_approval' : 'queued',
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    resultSummary: null,
    error: null,
    totalCostUsd: null,
    qaReport: null,
  };
  db.claudeCodeRuns.insert(run);
  return run;
}

/** Moves an awaiting_approval run to queued — the one place a
 *  full_with_approval-tier dispatch becomes executable, and it only
 *  happens on an explicit operator decision. */
export function approveQueuedRun(db: Db, id: string): ClaudeCodeRun {
  const run = db.claudeCodeRuns.byId(id);
  if (!run) throw new Error(`approveQueuedRun: no such run ${id}`);
  if (run.status !== 'awaiting_approval') throw new Error(`approveQueuedRun: run ${id} is not awaiting approval (status=${run.status})`);
  db.claudeCodeRuns.update(id, { status: 'queued' });
  return db.claudeCodeRuns.byId(id)!;
}

/**
 * Executes a queued run for real via execFn (injected — this module never
 * shells out itself) and records the outcome, success or failure, in the
 * same row. Refuses to execute a run that is still awaiting_approval —
 * this is the structural gate: an unapproved full_with_approval run
 * literally cannot reach dispatchClaudeCode.
 *
 * Post-run QA handoff (qaFn, injected — same DI shape as execFn): after a
 * REAL successful dispatch, automatically runs the target project's own
 * real test/typecheck/build pipeline and records the report on the row.
 * Never runs QA on a failed dispatch (nothing to review). A QA runner
 * that itself throws is recorded as a real, visible failure — never
 * silently dropped and never faked as a pass. qaFn is optional so
 * existing callers/tests that don't care about QA are unaffected.
 */
export async function executeQueuedRun(
  db: Db,
  id: string,
  execFn: ExecFn,
  qaFn?: (projectDir: string) => Promise<unknown>,
): Promise<ClaudeCodeRun> {
  const run = db.claudeCodeRuns.byId(id);
  if (!run) throw new Error(`executeQueuedRun: no such run ${id}`);
  if (run.status === 'awaiting_approval') {
    throw new Error(`executeQueuedRun: run ${id} is awaiting approval — approve it first via approveQueuedRun`);
  }
  if (run.status !== 'queued') {
    throw new Error(`executeQueuedRun: run ${id} is not queued (status=${run.status})`);
  }

  db.claudeCodeRuns.update(id, { status: 'running', startedAt: new Date().toISOString() });

  const result = await dispatchClaudeCode(execFn, {
    projectDir: run.projectDir,
    prompt: run.prompt,
    permissionLevel: run.permissionLevel,
  });

  if (result.ok && !('dryRun' in result && result.dryRun)) {
    db.claudeCodeRuns.update(id, {
      status: 'done',
      finishedAt: new Date().toISOString(),
      resultSummary: result.result,
      totalCostUsd: result.totalCostUsd,
    });

    if (qaFn) {
      let qaReport: string;
      try {
        const report = await qaFn(run.projectDir);
        qaReport = JSON.stringify(report);
      } catch (err) {
        qaReport = JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) });
      }
      db.claudeCodeRuns.update(id, { qaReport });
    }
  } else if (!result.ok) {
    db.claudeCodeRuns.update(id, { status: 'failed', finishedAt: new Date().toISOString(), error: result.reason });
  }

  return db.claudeCodeRuns.byId(id)!;
}
