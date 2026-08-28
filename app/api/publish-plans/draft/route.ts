import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/data';
import { SocialPlatformSchema } from '@/lib/schemas';
import { draftPublishPlan } from '@/lib/social-publishing';

export const dynamic = 'force-dynamic';

const DraftSchema = z.object({
  contentPieceId: z.string().min(1),
  platforms: z.array(SocialPlatformSchema).min(1),
  caption: z.string().min(1),
  projectId: z.string().nullable().optional(),
});

/** Drafts a publish plan for a produced content piece — always starts
 *  pending_approval, per the Approval Policy. */
export async function POST(req: Request) {
  const parsed = DraftSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { contentPieceId, platforms, caption, projectId } = parsed.data;
  const plan = draftPublishPlan(getDb(), { contentPieceId, platforms, caption, projectId: projectId ?? null });
  return NextResponse.json({ plan }, { status: 201 });
}
