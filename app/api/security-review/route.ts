import { NextResponse } from 'next/server';
import { getDb } from '@/lib/data';
import { runSecurityReview } from '@/lib/security-review-orchestrator';

export const dynamic = 'force-dynamic';

/**
 * Runs a REAL security review (npm audit + secret scan) against a
 * Project Registry-authorized project directory. Refuses any project
 * that is not both active and explicitly authorizing security-reviewer —
 * registering a project never implicitly grants access.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { projectId?: unknown } | null;
  const projectId = typeof body?.projectId === 'string' ? body.projectId : '';
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });

  const project = getDb().projects.byId(projectId);
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });
  if (project.status !== 'active') {
    return NextResponse.json({ error: `project is not active (status: ${project.status})` }, { status: 422 });
  }
  if (!project.authorizedAgentIds.includes('security-reviewer')) {
    return NextResponse.json(
      { error: 'security-reviewer is not authorized on this project — grant access from /projects first' },
      { status: 403 },
    );
  }
  if (project.kind !== 'local') {
    return NextResponse.json({ error: 'only local projects can be scanned on this machine today' }, { status: 422 });
  }

  const report = await runSecurityReview(project.pathOrUrl);
  return NextResponse.json({ report });
}
