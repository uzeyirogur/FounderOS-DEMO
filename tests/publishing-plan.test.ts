import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDb } from '@/lib/db';
import { draftPublishPlan, attemptPublish } from '@/lib/social-publishing';

/**
 * draftPublishPlan(db, { contentPieceId, platforms, projectId }) — plans
 * which channels a produced content piece goes to, per-platform caption
 * adaptation (simple length-aware truncation for platform limits), status
 * starts 'pending_approval' (never auto-approved).
 *
 * attemptPublish(db, planId, publishFn) — the ONLY function that can move a
 * plan to 'published'. Refuses anything not 'approved'. publishFn is
 * injected (the real Zernio connector in production) so this is testable
 * without a live account; a publish failure is recorded honestly.
 */
describe('draftPublishPlan', () => {
  let db: ReturnType<typeof openDb>;
  beforeEach(() => { db = openDb(':memory:'); });
  afterEach(() => { (db as any).close?.(); });

  it('drafts a plan at pending_approval — never auto-approved', () => {
    const plan = draftPublishPlan(db, {
      contentPieceId: 'c1',
      platforms: ['instagram', 'twitter'],
      caption: 'A caption long enough to matter for adaptation testing purposes here.',
      projectId: null,
    });
    expect(plan.status).toBe('pending_approval');
    expect(plan.adaptations).toHaveLength(2);
  });

  it('truncates a caption that exceeds a platform limit and flags it', () => {
    const longCaption = 'x'.repeat(300);
    const plan = draftPublishPlan(db, {
      contentPieceId: 'c1',
      platforms: ['twitter'],
      caption: longCaption,
      projectId: null,
    });
    expect(plan.adaptations[0].truncated).toBe(true);
    expect(plan.adaptations[0].caption.length).toBeLessThan(300);
  });

  it('does not truncate a short caption', () => {
    const plan = draftPublishPlan(db, { contentPieceId: 'c1', platforms: ['linkedin'], caption: 'short', projectId: null });
    expect(plan.adaptations[0].truncated).toBe(false);
    expect(plan.adaptations[0].caption).toBe('short');
  });
});

describe('attemptPublish', () => {
  let db: ReturnType<typeof openDb>;
  beforeEach(() => { db = openDb(':memory:'); });
  afterEach(() => { (db as any).close?.(); });

  it('refuses to publish a plan that is not approved', async () => {
    const plan = draftPublishPlan(db, { contentPieceId: 'c1', platforms: ['instagram'], caption: 'x', projectId: null });
    const result = await attemptPublish(db, plan.id, async () => ({ ok: true }));
    if (result.ok) throw new Error('expected attemptPublish to be refused');
    expect(result.reason).toMatch(/not approved/i);
  });

  it('publishes an approved plan via the injected publish function', async () => {
    const plan = draftPublishPlan(db, { contentPieceId: 'c1', platforms: ['instagram'], caption: 'x', projectId: null });
    db.publishPlans.decide(plan.id, 'approved', 'local-ui');
    const publishFn = async () => ({ ok: true as const });
    const result = await attemptPublish(db, plan.id, publishFn);
    expect(result.ok).toBe(true);
    expect(db.publishPlans.byId(plan.id)?.status).toBe('published');
  });

  it('records a real publish failure, never silently drops it', async () => {
    const plan = draftPublishPlan(db, { contentPieceId: 'c1', platforms: ['instagram'], caption: 'x', projectId: null });
    db.publishPlans.decide(plan.id, 'approved', 'local-ui');
    const publishFn = async () => ({ ok: false as const, reason: 'ZERNIO_API_KEY not set' });
    const result = await attemptPublish(db, plan.id, publishFn);
    expect(result.ok).toBe(false);
    const row = db.publishPlans.byId(plan.id);
    expect(row?.status).toBe('failed');
    expect(row?.failureReason).toBe('ZERNIO_API_KEY not set');
  });
});
