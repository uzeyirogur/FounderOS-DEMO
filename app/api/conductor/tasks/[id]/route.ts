import { NextResponse } from 'next/server';
import { getDb } from '@/lib/data';
import { startTask, completeTask, failTask, retryTask } from '@/lib/conductor';

export const dynamic = 'force-dynamic';

/**
 * State transitions for a single delegated task: start / complete / fail /
 * retry. This is the Conductor's real dispatch lifecycle — a failed agent
 * can be retried (optionally reassigned) rather than silently dropped.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  if (!db.delegatedTasks.byId(id)) {
    return NextResponse.json({ error: 'task not found' }, { status: 404 });
  }
  const body = await req.json();
  switch (body?.action) {
    case 'start':
      startTask(db, id);
      break;
    case 'complete':
      completeTask(db, id, typeof body.resultSummary === 'string' ? body.resultSummary : 'done');
      break;
    case 'fail':
      failTask(db, id, typeof body.failureReason === 'string' ? body.failureReason : 'unknown failure');
      break;
    case 'retry': {
      const retried = retryTask(db, id, typeof body.reassignTo === 'string' ? { reassignTo: body.reassignTo } : undefined);
      return NextResponse.json({ task: retried });
    }
    default:
      return NextResponse.json({ error: "action must be one of 'start' | 'complete' | 'fail' | 'retry'" }, { status: 400 });
  }
  return NextResponse.json({ task: db.delegatedTasks.byId(id) });
}
