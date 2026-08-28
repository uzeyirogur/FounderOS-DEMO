import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getDb } from '@/lib/data';
import { IdeaStatusSchema } from '@/lib/schemas';
import { scoreIdea } from '@/lib/ideas';

export const dynamic = 'force-dynamic';

/**
 * Idea Lab register. POST creates and scores an idea from the operator's
 * three 1..5 ratings (never an invented number); GET lists every idea with
 * its score attached, highest-scoring first, so the highest-leverage idea is
 * always the first thing the operator sees.
 */
const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
  marketSize: z.number().int().min(1).max(5),
  effort: z.number().int().min(1).max(5),
  strategicFit: z.number().int().min(1).max(5),
  status: IdeaStatusSchema.default('new'),
});

export async function GET() {
  const ideas = getDb()
    .ideas.all()
    .map((i) => ({ ...i, score: scoreIdea(i) }))
    .sort((a, b) => b.score - a.score);
  return NextResponse.json({ ideas });
}

export async function POST(req: Request) {
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const now = new Date().toISOString();
  const idea = { ...parsed.data, id: randomUUID(), projectId: null, createdAt: now, updatedAt: now };
  getDb().ideas.insert(idea);
  return NextResponse.json({ idea, score: scoreIdea(idea) }, { status: 201 });
}
