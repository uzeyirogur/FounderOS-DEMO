import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getDb } from '@/lib/data';
import { PersonalTaskPrioritySchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

const CreateSchema = z.object({
  title: z.string().min(1),
  dueAt: z.string().nullable().optional(),
  priority: PersonalTaskPrioritySchema.nullable().optional(),
});

/** Adds a task to Alex's personal list. Never tied to a Project Registry project. */
export async function POST(req: Request) {
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { title, dueAt, priority } = parsed.data;
  const task = {
    id: randomUUID(),
    title,
    dueAt: dueAt ?? null,
    priority: priority ?? ('normal' as const),
    status: 'open' as const,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  getDb().personalTasks.insert(task);
  return NextResponse.json({ task }, { status: 201 });
}
