import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/data';

export const dynamic = 'force-dynamic';

/**
 * The ONE endpoint that can flip a Capability Registry row to active. This
 * is a human decision by construction — it is only ever called from the
 * /capabilities UI's approve button, never from agent code. See the
 * Approval Policy: paid/credentialed capabilities never self-activate.
 */
const ApproveSchema = z.object({
  allowedAgents: z.array(z.string().min(1)).default([]),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const db = getDb();
  const existing = db.capabilities.byId(params.id);
  if (!existing) return NextResponse.json({ error: 'capability not found' }, { status: 404 });

  const parsed = ApproveSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  db.capabilities.approve(params.id, parsed.data.allowedAgents);
  return NextResponse.json({ capability: db.capabilities.byId(params.id) });
}
