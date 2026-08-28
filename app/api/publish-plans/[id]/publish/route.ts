import { NextResponse } from 'next/server';
import { getDb } from '@/lib/data';
import { attemptPublishLive } from '@/lib/social-publishing';

export const dynamic = 'force-dynamic';

/** Attempts a real publish for an APPROVED plan. Refuses anything not
 *  already approved; reports the true outcome (today: honestly
 *  not_configured — no real channel connector implements a publish
 *  endpoint yet). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const db = getDb();
  const existing = db.publishPlans.byId(params.id);
  if (!existing) return NextResponse.json({ error: 'plan not found' }, { status: 404 });

  const result = await attemptPublishLive(db, params.id);
  return NextResponse.json({ result, plan: db.publishPlans.byId(params.id) });
}
