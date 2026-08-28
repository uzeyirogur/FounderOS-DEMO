import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/data';
import { CONTENT_KINDS } from '@/lib/schemas';
import { produceContentPiece } from '@/lib/content-studio';
import { discoverCapabilityLive } from '@/lib/capability-discovery';
import { chat } from '@/lib/connectors/llm';

export const dynamic = 'force-dynamic';

const ProduceSchema = z.object({
  kind: z.enum(CONTENT_KINDS),
  brief: z.string().min(1).max(2000),
  projectId: z.string().nullable().optional(),
});

/**
 * The real production endpoint: a social_post/carousel is written directly
 * via the LLM gateway; every other kind checks the Capability Registry for
 * an active tool and runs live discovery if nothing is active — never
 * fabricates media it did not actually produce. Same flow the
 * produceContent chat tool calls.
 */
export async function POST(req: Request) {
  const parsed = ProduceSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { kind, brief, projectId } = parsed.data;
  const piece = await produceContentPiece(
    getDb(),
    { kind, brief, projectId: projectId ?? null },
    { chat, discover: discoverCapabilityLive },
  );
  return NextResponse.json({ piece }, { status: 201 });
}
