import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/data';

export const dynamic = 'force-dynamic';

/**
 * Records a human decision on an approval_request notification. This is the
 * one endpoint a delivery channel's inbound handler (WhatsApp reply parser,
 * once built — see docs/WHATSAPP_CHANNEL_ARCHITECTURE.md) calls; it is also
 * exactly what the local /notifications page's approve/reject buttons call.
 * Same endpoint either way — the queue does not care which surface a
 * decision came from, only that it is attributable (decidedBy is required,
 * never blank) and that it targets a real approval_request row.
 *
 * decidedBy is a free-text identifier (e.g. 'whatsapp:+90501234567' or
 * 'local-ui') for audit — it is NOT used as an authorization credential by
 * itself. See the architecture doc's shared-secret note: authorization to
 * reach this endpoint at all is what gates who can decide, not the string
 * inside decidedBy.
 */
const DecideSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  decidedBy: z.string().min(1),
  responseText: z.string().nullable().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const parsed = DecideSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = getDb();
  const existing = db.notifications.byId(params.id);
  if (!existing) return NextResponse.json({ error: 'notification not found' }, { status: 404 });

  if (!existing.requiresApproval) {
    return NextResponse.json(
      { error: `notification kind '${existing.kind}' is informational and cannot be decided` },
      { status: 422 },
    );
  }
  if (existing.status !== 'pending' && existing.status !== 'sent') {
    return NextResponse.json({ error: `notification already decided (status: ${existing.status})` }, { status: 422 });
  }

  const { decision, decidedBy, responseText } = parsed.data;
  db.notifications.decide(params.id, decision, decidedBy, responseText ?? null);
  return NextResponse.json({ notification: db.notifications.byId(params.id) });
}
