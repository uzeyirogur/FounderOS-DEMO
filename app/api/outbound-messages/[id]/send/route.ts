import { NextResponse } from 'next/server';
import { getDb } from '@/lib/data';
import { attemptSendLive } from '@/lib/communications';

export const dynamic = 'force-dynamic';

/** Attempts a real send for an APPROVED message. Refuses anything not
 *  already approved; reports the true outcome. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const db = getDb();
  const existing = db.outboundMessages.byId(params.id);
  if (!existing) return NextResponse.json({ error: 'message not found' }, { status: 404 });

  const result = await attemptSendLive(db, params.id);
  return NextResponse.json({ result, message: db.outboundMessages.byId(params.id) });
}
