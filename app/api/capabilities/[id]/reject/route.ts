import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/data';

export const dynamic = 'force-dynamic';

const RejectSchema = z.object({
  notes: z.string().max(1000).nullable().default(null),
});

/** Marks a candidate as rejected — kept for the record so it is not
 *  silently re-proposed by the exact same search, but an agent may still
 *  re-surface it later if the landscape changes (a fresh discovery run
 *  would insert a new row anyway; this one stays 'rejected'). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const db = getDb();
  const existing = db.capabilities.byId(params.id);
  if (!existing) return NextResponse.json({ error: 'capability not found' }, { status: 404 });

  const parsed = RejectSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  db.capabilities.reject(params.id, parsed.data.notes);
  return NextResponse.json({ capability: db.capabilities.byId(params.id) });
}
