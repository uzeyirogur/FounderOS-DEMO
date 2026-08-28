import { NextResponse } from 'next/server';
import { getDb } from '@/lib/data';

export const dynamic = 'force-dynamic';

/** Marks a personal task done. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const db = getDb();
  const existing = db.personalTasks.byId(params.id);
  if (!existing) return NextResponse.json({ error: 'task not found' }, { status: 404 });
  db.personalTasks.complete(params.id);
  return NextResponse.json({ task: db.personalTasks.byId(params.id) });
}
