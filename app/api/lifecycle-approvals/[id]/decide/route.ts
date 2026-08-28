import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/data';

export const dynamic = 'force-dynamic';

/**
 * Records a human decision on a lifecycle approval gate (e.g.
 * deployment_approval). Mirrors app/api/notifications/[id]/decide's shape
 * and audit rules: decidedBy is a free-text identifier, never blank, never
 * itself an authorization credential.
 */
const DecideSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  decidedBy: z.string().min(1),
  notes: z.string().nullable().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const parsed = DecideSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = getDb();
  const existing = db.lifecycleApprovals.byId(params.id);
  if (!existing) return NextResponse.json({ error: 'approval not found' }, { status: 404 });
  if (existing.status !== 'pending') {
    return NextResponse.json({ error: `approval already decided (status: ${existing.status})` }, { status: 422 });
  }

  const { decision, decidedBy, notes } = parsed.data;
  db.lifecycleApprovals.decide(params.id, decision, decidedBy, notes ?? null);
  return NextResponse.json({ approval: db.lifecycleApprovals.byId(params.id) });
}
