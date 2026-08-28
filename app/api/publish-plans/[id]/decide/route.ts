import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/data';

export const dynamic = 'force-dynamic';

const DecideSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  decidedBy: z.string().min(1),
});

/** Records the operator's approve/reject decision on a publish plan. Same
 *  audit rules as notifications/lifecycle-approvals: decidedBy is free
 *  text for the record, never itself an authorization credential. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const parsed = DecideSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = getDb();
  const existing = db.publishPlans.byId(params.id);
  if (!existing) return NextResponse.json({ error: 'plan not found' }, { status: 404 });
  if (existing.status !== 'pending_approval') {
    return NextResponse.json({ error: `plan already decided (status: ${existing.status})` }, { status: 422 });
  }

  db.publishPlans.decide(params.id, parsed.data.decision, parsed.data.decidedBy);
  return NextResponse.json({ plan: db.publishPlans.byId(params.id) });
}
