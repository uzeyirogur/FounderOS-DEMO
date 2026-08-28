import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/data';
import { currentStreak } from '@/lib/personal-ops';

export const dynamic = 'force-dynamic';

/** Logs today's check-in. Append-only and idempotent per calendar day. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const db = getDb();
  const routine = db.routines.byId(params.id);
  if (!routine) return NextResponse.json({ error: 'routine not found' }, { status: 404 });

  const today = new Date().toISOString().slice(0, 10);
  db.routineCompletions.insert({ id: randomUUID(), routineId: params.id, completedOn: today, completedAt: new Date().toISOString() });
  const streak = currentStreak(db.routineCompletions.forRoutine(params.id).map((c) => c.completedOn), today);
  return NextResponse.json({ routineId: params.id, completedOn: today, streak });
}
