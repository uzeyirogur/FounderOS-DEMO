import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/data';
import { IdeaStatusSchema } from '@/lib/schemas';
import { scoreIdea } from '@/lib/ideas';

export const dynamic = 'force-dynamic';

const PatchSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000),
    marketSize: z.number().int().min(1).max(5),
    effort: z.number().int().min(1).max(5),
    strategicFit: z.number().int().min(1).max(5),
    status: IdeaStatusSchema,
  })
  .partial();

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const db = getDb();
  const existing = db.ideas.byId(params.id);
  if (!existing) return NextResponse.json({ error: 'idea not found' }, { status: 404 });
  const updated = { ...existing, ...parsed.data, id: existing.id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
  db.ideas.insert(updated);
  return NextResponse.json({ idea: updated, score: scoreIdea(updated) });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const removed = getDb().ideas.remove(params.id);
  if (!removed) return NextResponse.json({ error: 'idea not found' }, { status: 404 });
  return NextResponse.json({ ok: true, id: params.id });
}
