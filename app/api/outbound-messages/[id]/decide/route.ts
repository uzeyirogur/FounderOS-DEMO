import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/data';

export const dynamic = 'force-dynamic';

const DecideSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  decidedBy: z.string().min(1),
});

/** Records the operator's approve/reject decision on an outbound message. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const parsed = DecideSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = getDb();
  const existing = db.outboundMessages.byId(params.id);
  if (!existing) return NextResponse.json({ error: 'message not found' }, { status: 404 });
  if (existing.status !== 'pending_approval') {
    return NextResponse.json({ error: `message already decided (status: ${existing.status})` }, { status: 422 });
  }

  db.outboundMessages.decide(params.id, parsed.data.decision, parsed.data.decidedBy);
  return NextResponse.json({ message: db.outboundMessages.byId(params.id) });
}
