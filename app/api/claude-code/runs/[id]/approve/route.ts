import { NextResponse } from 'next/server';
import { getDb } from '@/lib/data';
import { approveQueuedRun } from '@/lib/claude-code-queue';

export const dynamic = 'force-dynamic';

/**
 * Approves a full_with_approval-tier queued run, moving it from
 * awaiting_approval -> queued so it becomes eligible for execution. This
 * is the operator's explicit go-ahead for the highest-autonomy tier —
 * approving does NOT execute the run; a separate call to
 * /api/claude-code/runs/[id]/execute is still required and is the one
 * that actually spends money.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  if (!db.claudeCodeRuns.byId(id)) return NextResponse.json({ error: 'run not found' }, { status: 404 });
  try {
    const run = approveQueuedRun(db, id);
    return NextResponse.json({ run });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 409 });
  }
}
