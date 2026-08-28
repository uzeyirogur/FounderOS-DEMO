import { NextResponse } from 'next/server';
import { getDb } from '@/lib/data';
import { delegateTask } from '@/lib/conductor';

export const dynamic = 'force-dynamic';

/** Every delegated task, optionally filtered to one project — this is what
 *  lets the UI show "what is the Chief of Staff actually dispatching". */
export async function GET(req: Request) {
  const db = getDb();
  const projectId = new URL(req.url).searchParams.get('projectId');
  const tasks = projectId ? db.delegatedTasks.byProjectId(projectId) : db.delegatedTasks.all();
  return NextResponse.json({ tasks });
}

/** Delegate a new task. Classifies the agent from the goal unless one is
 *  given explicitly. Duplicate-safe: delegating the same open task twice
 *  returns the existing row instead of creating a second one. */
export async function POST(req: Request) {
  const body = await req.json();
  if (typeof body?.goal !== 'string' || body.goal.trim().length === 0) {
    return NextResponse.json({ error: 'goal is required' }, { status: 400 });
  }
  const task = delegateTask(getDb(), {
    source: typeof body.source === 'string' ? body.source : 'user',
    projectId: typeof body.projectId === 'string' ? body.projectId : null,
    goal: body.goal,
    assignedAgentId: typeof body.assignedAgentId === 'string' ? body.assignedAgentId : undefined,
    priority: body.priority,
    dependencies: Array.isArray(body.dependencies) ? body.dependencies : undefined,
  });
  return NextResponse.json({ task }, { status: 201 });
}
