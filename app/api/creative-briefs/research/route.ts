import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/data';
import { CreativeFormatSchema } from '@/lib/schemas';
import { runCreativeResearchLive } from '@/lib/ad-creative-research';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  projectId: z.string().min(1),
  format: CreativeFormatSchema,
  query: z.string().min(1),
});

/** Runs a REAL creative research pass — live web search, honest failure when
 *  BRAVE_SEARCH_API_KEY is not configured (never a fabricated brief). */
export async function POST(req: Request) {
  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

  try {
    const brief = await runCreativeResearchLive(getDb(), body.data);
    return NextResponse.json({ brief });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'research failed' }, { status: 422 });
  }
}
