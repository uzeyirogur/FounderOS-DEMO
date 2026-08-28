import { NextResponse } from 'next/server';
import { getDb } from '@/lib/data';
import { currentStreak } from '@/lib/personal-ops';

export const dynamic = 'force-dynamic';

/** Every routine, each with its current streak computed from the real
 *  completion log. */
export async function GET() {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const routines = db.routines.all().map((r) => ({
    ...r,
    streak: currentStreak(db.routineCompletions.forRoutine(r.id).map((c) => c.completedOn), today),
  }));
  return NextResponse.json({ routines });
}
