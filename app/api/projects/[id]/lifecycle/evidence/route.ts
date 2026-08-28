import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/data';
import { recordEvidence } from '@/lib/project-lifecycle-orchestrator';
import { PHASE_EXIT_EVIDENCE, PROJECT_LIFECYCLE_PHASES } from '@/lib/project-lifecycle';

export const dynamic = 'force-dynamic';

const EvidenceSchema = z.object({
  phase: z.enum(PROJECT_LIFECYCLE_PHASES),
  kind: z.enum(['build_test', 'qa_report', 'security_report', 'ui_ux_report', 'launch_checklist']),
  ok: z.boolean(),
  summary: z.string().min(1),
  recordedByAgentId: z.string().min(1),
});

/**
 * Records real evidence for a phase — a real build/test run, a real QA/
 * security/UI-UX report, or a real launch checklist. This is what
 * advancePhase actually checks for evidence-gated phases (implementation/
 * qa/security/ui_ux/launch_readiness) — a phase does not advance because
 * an agent said "done", it advances because a passing evidence row exists.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const db = getDb();
  const project = db.projects.all().find((p) => p.id === params.id);
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });

  const parsed = EvidenceSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const expectedKind = PHASE_EXIT_EVIDENCE[parsed.data.phase];
  if (!expectedKind) {
    return NextResponse.json({ error: `phase '${parsed.data.phase}' has no evidence requirement — nothing to record` }, { status: 400 });
  }
  if (expectedKind !== parsed.data.kind) {
    return NextResponse.json({ error: `phase '${parsed.data.phase}' expects evidence kind '${expectedKind}', got '${parsed.data.kind}'` }, { status: 422 });
  }

  const evidence = recordEvidence(db, { projectId: params.id, ...parsed.data });
  return NextResponse.json({ evidence }, { status: 201 });
}

/** All recorded evidence for one project, newest first. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const db = getDb();
  const project = db.projects.all().find((p) => p.id === params.id);
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });
  return NextResponse.json({ evidence: db.lifecycleEvidence.byProjectId(params.id) });
}
