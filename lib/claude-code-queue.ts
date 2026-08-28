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
 */
export async function executeQueuedRun(db: Db, id: string, execFn: ExecFn): Promise<ClaudeCodeRun> {
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
  } else if (!result.ok) {
    db.claudeCodeRuns.update(id, { status: 'failed', finishedAt: new Date().toISOString(), error: result.reason });
  }

  return db.claudeCodeRuns.byId(id)!;
}
