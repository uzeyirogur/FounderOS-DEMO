import { randomUUID } from 'node:crypto';
import type { openDb } from '@/lib/db';
import type { PlatformAdaptation, PublishPlan, SocialPlatform } from '@/lib/schemas';

type Db = ReturnType<typeof openDb>;

/** Simple, honest per-platform limits — not exhaustive, but enough to flag
 *  when a caption needs shortening rather than silently posting truncated
 *  garbage on a real channel. Twitter/X is the tightest at 280. */
const PLATFORM_CAPTION_LIMIT: Record<SocialPlatform, number> = {
  twitter: 280,
  instagram: 2200,
  tiktok: 2200,
  linkedin: 3000,
  youtube: 5000,
};

function adaptForPlatform(platform: SocialPlatform, caption: string): PlatformAdaptation {
  const limit = PLATFORM_CAPTION_LIMIT[platform];
  if (caption.length <= limit) return { platform, caption, truncated: false };
  return { platform, caption: caption.slice(0, limit - 1) + '…', truncated: true };
}

export interface DraftPublishPlanInput {
  contentPieceId: string;
  platforms: SocialPlatform[];
  caption: string;
  projectId: string | null;
}

/**
 * Plans which channels a produced content piece goes to and how the
 * caption is adapted per channel — separate from Content Studio (which only
 * produces content). Always starts at 'pending_approval': per the Approval
 * Policy, a real social media post is never made without an explicit human
 * decision first.
 */
export function draftPublishPlan(db: Db, input: DraftPublishPlanInput): PublishPlan {
  const plan: PublishPlan = {
    id: randomUUID(),
    projectId: input.projectId,
    contentPieceId: input.contentPieceId,
    platforms: input.platforms,
    adaptations: input.platforms.map((p) => adaptForPlatform(p, input.caption)),
    status: 'pending_approval',
    createdAt: new Date().toISOString(),
    decidedAt: null,
    decidedBy: null,
    publishedAt: null,
    failureReason: null,
  };
  db.publishPlans.insert(plan);
  return plan;
}

export type PublishFn = (plan: PublishPlan) => Promise<{ ok: true } | { ok: false; reason: string }>;
export type AttemptPublishResult = { ok: true } | { ok: false; reason: string };

/**
 * The ONE function that can move a plan to 'published'. Refuses anything
 * that is not already 'approved' — a human decision is a precondition,
 * not something this function can grant. publishFn is injected (the real
 * channel connector, e.g. Zernio) so a real failure (missing credential,
 * API error) is recorded honestly rather than silently dropped or faked
 * as success.
 */
export async function attemptPublish(db: Db, planId: string, publishFn: PublishFn): Promise<AttemptPublishResult> {
  const plan = db.publishPlans.byId(planId);
  if (!plan) return { ok: false, reason: 'plan not found' };
  if (plan.status !== 'approved') {
    return { ok: false, reason: `plan is not approved (status: ${plan.status})` };
  }

  const result = await publishFn(plan);
  if (result.ok) {
    db.publishPlans.markPublished(planId);
    return { ok: true };
  }
  db.publishPlans.markFailed(planId, result.reason);
  return result;
}

/**
 * attemptPublish wired to real per-platform connectors. Each platform in
 * the plan is dispatched to its own real official-API connector
 * (Instagram Graph API, X API v2, LinkedIn Posts API — see
 * lib/connectors/*-publish.ts); a platform with no real connector yet
 * (TikTok, YouTube) is honestly not_configured, never invented. A plan
 * targeting multiple platforms succeeds only if EVERY platform's publish
 * call succeeds — a partial publish is reported as a failure naming
 * which platform(s) failed, never silently reported as success.
 */
export async function attemptPublishLive(db: Db, planId: string): Promise<AttemptPublishResult> {
  return attemptPublish(db, planId, async (plan) => {
    const { publishToXLive } = await import('@/lib/connectors/x-publish');
    const { publishToLinkedInLive } = await import('@/lib/connectors/linkedin-publish');

    const failures: string[] = [];
    for (const adaptation of plan.adaptations) {
      let result: { ok: true; postId: string } | { ok: false; reason: string };
      switch (adaptation.platform) {
        case 'instagram': {
          // Instagram's Graph API requires a real image/video URL — this
          // plan shape (PlatformAdaptation) carries only a caption today,
          // no media URL. Rather than invent a placeholder image (which
          // would silently post garbage to a real account), this is an
          // honest not_configured gap until PublishPlan carries a real
          // media URL sourced from the ContentPiece's own output.
          result = { ok: false, reason: 'Instagram publish needs a real media URL on the plan — not yet wired from ContentPiece.output.' };
          break;
        }
        case 'twitter':
          result = await publishToXLive({ text: adaptation.caption });
          break;
        case 'linkedin':
          result = await publishToLinkedInLive({ text: adaptation.caption });
          break;
        default:
          result = { ok: false, reason: `No real publish connector wired for platform "${adaptation.platform}" yet.` };
      }
      if (!result.ok) failures.push(`${adaptation.platform}: ${result.reason}`);
    }

    if (failures.length > 0) {
      return { ok: false, reason: failures.join(' | ') };
    }
    return { ok: true };
  });
}
