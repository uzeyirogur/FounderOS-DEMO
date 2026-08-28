import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/data';
import { GrowthFocusSchema } from '@/lib/schemas';
import { runGrowthResearchLive } from '@/lib/growth-marketing';

export const dynamic = 'force-dynamic';

const ResearchSchema = z.object({
  projectId: z.string().min(1),
  focus: GrowthFocusSchema,
  query: z.string().min(1).max(300),
});

/** Triggers a real growth-research pass via live web search. Honest
 *  404-equivalent (400 here, since it's a config issue not a missing
 *  resource) when BRAVE_SEARCH_API_KEY is unset — see runGrowthResearchLive. */
export async function POST(req: Request) {
  const parsed = ResearchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const db = getDb();
  const project = db.projects.all().find((p) => p.id === parsed.data.projectId);
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });
  try {
    const brief = await runGrowthResearchLive(db, parsed.data);
    return NextResponse.json({ brief }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 422 });
  }
}
