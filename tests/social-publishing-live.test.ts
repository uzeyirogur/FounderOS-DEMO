import { describe, it, expect, afterEach, vi } from 'vitest';
import { openDb, type FounderDb } from '@/lib/db';
import { draftPublishPlan, attemptPublishLive } from '@/lib/social-publishing';

/**
 * attemptPublishLive wired to real per-platform connectors
 * (lib/connectors/{instagram,x,linkedin}-publish.ts). Never fabricates
 * success: an unconfigured/failing platform is a real, named failure.
 */
describe('attemptPublishLive — real per-platform dispatch', () => {
  let db: FounderDb;
  const prevEnv = { ...process.env };
  afterEach(() => {
    db?.close();
    process.env = { ...prevEnv };
  });

  it('reports honest failure for an unconfigured platform (X, no credential)', async () => {
    db = openDb(':memory:');
    delete process.env.X_API_BEARER_TOKEN;
    const plan = draftPublishPlan(db, { contentPieceId: 'cp1', platforms: ['twitter'], caption: 'hello world', projectId: null });
    db.publishPlans.decide(plan.id, 'approved', 'local-ui');
    const result = await attemptPublishLive(db, plan.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/twitter.*X_API_BEARER_TOKEN/i);
  });

  it('reports Instagram as honestly not_configured for the real reason (no media URL on the plan)', async () => {
    db = openDb(':memory:');
    const plan = draftPublishPlan(db, { contentPieceId: 'cp1', platforms: ['instagram'], caption: 'hello world', projectId: null });
    db.publishPlans.decide(plan.id, 'approved', 'local-ui');
    const result = await attemptPublishLive(db, plan.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/instagram.*media URL/i);
  });

  it('reports a platform with no real connector (tiktok) as honestly not_configured', async () => {
    db = openDb(':memory:');
    const plan = draftPublishPlan(db, { contentPieceId: 'cp1', platforms: ['tiktok'], caption: 'hello world', projectId: null });
    db.publishPlans.decide(plan.id, 'approved', 'local-ui');
    const result = await attemptPublishLive(db, plan.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/no real publish connector/i);
  });

  it('a multi-platform plan fails as a whole and names every failing platform when any one fails', async () => {
    db = openDb(':memory:');
    delete process.env.X_API_BEARER_TOKEN;
    delete process.env.LINKEDIN_ACCESS_TOKEN;
    const plan = draftPublishPlan(db, { contentPieceId: 'cp1', platforms: ['twitter', 'linkedin'], caption: 'hello world', projectId: null });
    db.publishPlans.decide(plan.id, 'approved', 'local-ui');
    const result = await attemptPublishLive(db, plan.id);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/twitter/);
      expect(result.reason).toMatch(/linkedin/);
    }
  });

  it('succeeds only when every targeted platform genuinely succeeds', async () => {
    db = openDb(':memory:');
    process.env.X_API_BEARER_TOKEN = 'fake-token';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { id: 'tweet-1' } }) }));
    const plan = draftPublishPlan(db, { contentPieceId: 'cp1', platforms: ['twitter'], caption: 'hello world', projectId: null });
    db.publishPlans.decide(plan.id, 'approved', 'local-ui');
    const result = await attemptPublishLive(db, plan.id);
    expect(result.ok).toBe(true);
    expect(db.publishPlans.byId(plan.id)?.status).toBe('published');
    vi.unstubAllGlobals();
  });
});
