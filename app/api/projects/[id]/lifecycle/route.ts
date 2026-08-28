import { NextResponse } from 'next/server';
import { getDb } from '@/lib/data';
import { projectLifecycleSummary } from '@/lib/project-lifecycle-orchestrator';

export const dynamic = 'force-dynamic';

/**
 * A single project's lifecycle picture: current phase, who is responsible
 * for it right now, its open/blocked tasks, and any approval it is waiting
 * on. Lazily creates the lifecycle row at phase 'idea' on first read — a
 * project registered before this feature shipped, or one nobody has looked
 * at yet, is not an error, it just starts at the beginning.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const db = getDb();
  const project = db.projects.all().find((p) => p.id === params.id);
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });

  const summary = projectLifecycleSummary(db, params.id);
  const history = db.lifecycleState.byProjectId(params.id)?.history ?? [];
  return NextResponse.json({ ...summary, history });
}
