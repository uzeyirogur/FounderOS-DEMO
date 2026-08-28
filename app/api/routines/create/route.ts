import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getDb } from '@/lib/data';
import { RoutineFrequencySchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

const CreateSchema = z.object({ title: z.string().min(1), frequency: RoutineFrequencySchema });

/** Adds a recurring routine. Never a one-off task, never a project. */
export async function POST(req: Request) {
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { title, frequency } = parsed.data;
  const routine = { id: randomUUID(), title, frequency, active: true, createdAt: new Date().toISOString() };
  getDb().routines.insert(routine);
  return NextResponse.json({ routine }, { status: 201 });
}
