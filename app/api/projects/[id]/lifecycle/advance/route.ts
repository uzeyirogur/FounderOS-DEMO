import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/data';
import { advancePhase } from '@/lib/project-lifecycle-orchestrator';

export const dynamic = 'force-dynamic';

const AdvanceSchema = z.object({
  requestedByAgentId: z.string().min(1).default('conductor'),
});

/**
 * Moves a project one step forward in the standard lifecycle. Refuses past
 * the last phase, and refuses to leave an approval-gated phase (today:
 * deployment_approval) until its LifecycleApproval row is approved — see
 * lib/project-lifecycle-orchestrator.ts for the exact rules.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const db = getDb();
  const project = db.projects.all().find((p) => p.id === params.id);
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });

  const parsed = AdvanceSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const result = advancePhase(db, params.id, parsed.data.requestedByAgentId);
  if (!result.ok) return NextResponse.json({ error: result.reason, state: result.state }, { status: 422 });
  return NextResponse.json({ state: result.state });
}
