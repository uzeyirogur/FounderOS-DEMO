import { NextResponse } from 'next/server';
import { getDb } from '@/lib/data';
import { executeQueuedRun } from '@/lib/claude-code-queue';

export const dynamic = 'force-dynamic';

/**
 * Executes a queued Claude Code run for real — a REAL, PAID call against
 * the operator's Anthropic account via the `claude` CLI. This is the ONE
 * route in the whole pipeline that spends money; queuing (POST /api/
 * claude-code/dispatch) never does. Refuses (409) a run that is still
 * awaiting_approval — that gate cannot be bypassed by calling this route
 * directly.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const run = db.claudeCodeRuns.byId((await params).id);
  if (!run) return NextResponse.json({ error: 'run not found' }, { status: 404 });
  if (run.status === 'awaiting_approval') {
    return NextResponse.json({ error: 'run is awaiting approval — approve it first via /api/claude-code/runs/[id]/approve' }, { status: 409 });
  }
  if (run.status !== 'queued') {
    return NextResponse.json({ error: `run is not queued (status: ${run.status})` }, { status: 409 });
  }

  const { dispatchClaudeCodeLiveExecFn } = await import('@/lib/claude-code-dispatch-exec');
  const updated = await executeQueuedRun(db, run.id, dispatchClaudeCodeLiveExecFn);
  return NextResponse.json({ run: updated });
}
