import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/data';
import { OutboundChannelSchema } from '@/lib/schemas';
import { draftOutboundMessage } from '@/lib/communications';

export const dynamic = 'force-dynamic';

const DraftSchema = z.object({
  channel: OutboundChannelSchema,
  to: z.string().min(1),
  subject: z.string().nullable().optional(),
  body: z.string().min(1),
});

/** Drafts an outbound message — always starts pending_approval, per the
 *  Approval Policy. */
export async function POST(req: Request) {
  const parsed = DraftSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { channel, to, body, subject } = parsed.data;
  const msg = draftOutboundMessage(getDb(), { channel, to, subject: subject ?? null, body });
  return NextResponse.json({ message: msg }, { status: 201 });
}
