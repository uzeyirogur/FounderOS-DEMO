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
 * attemptPublish wired to a real channel connector. Today this is honestly
 * not_configured: lib/connectors/zernio.ts implements only READ endpoints
 * (accounts, history) — no create-post/publish call exists yet, and one is
 * not invented here. Once a real publish endpoint is wired to a connector,
 * this function is the only place that needs to change; the approval gate
 * in attemptPublish() above is unaffected.
 */
export async function attemptPublishLive(db: Db, planId: string): Promise<AttemptPublishResult> {
  return attemptPublish(db, planId, async () => ({
    ok: false,
    reason:
      'No real publish connector is wired yet — lib/connectors/zernio.ts only reads (accounts/history), it has no create-post endpoint implemented. Approve/reject still work; live posting needs that connector built first.',
  }));
}
