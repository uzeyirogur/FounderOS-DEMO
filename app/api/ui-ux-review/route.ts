import { NextResponse } from 'next/server';
import { getDb } from '@/lib/data';
import { runUiUxReview } from '@/lib/ui-ux-review-orchestrator';

export const dynamic = 'force-dynamic';

/**
 * Runs a REAL static accessibility scan against a Project Registry-
 * authorized directory. Refuses any project that is not both active
 * and explicitly authorizing ui-ux-reviewer.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { projectId?: unknown } | null;
  const projectId = typeof body?.projectId === 'string' ? body.projectId : '';
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });

  const project = getDb().projects.byId(projectId);
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });
  if (project.status !== 'active') {
    return NextResponse.json({ error: `project is not active (status: ${project.status})` }, { status: 422 });
  }
  if (!project.authorizedAgentIds.includes('ui-ux-reviewer')) {
    return NextResponse.json(
      { error: 'ui-ux-reviewer is not authorized on this project — grant access from /projects first' },
      { status: 403 },
    );
  }
  if (project.kind !== 'local') {
    return NextResponse.json({ error: 'only local projects can be scanned on this machine today' }, { status: 422 });
  }

  const report = runUiUxReview(project.pathOrUrl);
  return NextResponse.json({ report });
}
