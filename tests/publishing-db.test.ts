import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDb } from '@/lib/db';

describe('publishPlans repo', () => {
  let db: ReturnType<typeof openDb>;
  beforeEach(() => { db = openDb(':memory:'); });
  afterEach(() => { (db as any).close?.(); });

  const now = new Date().toISOString();
  const base = {
    id: 'pp1', projectId: null, contentPieceId: 'c1', platforms: ['instagram', 'linkedin'] as ('instagram' | 'linkedin')[],
    adaptations: [
      { platform: 'instagram' as const, caption: 'short', truncated: false },
      { platform: 'linkedin' as const, caption: 'long', truncated: false },
    ],
    status: 'pending_approval' as const, createdAt: now, decidedAt: null, decidedBy: null, publishedAt: null, failureReason: null,
  };

  it('insert + all round-trips a plan with adaptations', () => {
    db.publishPlans.insert(base);
    const rows = db.publishPlans.all();
    expect(rows).toHaveLength(1);
    expect(rows[0].adaptations).toHaveLength(2);
  });

  it('pending() lists only pending_approval plans', () => {
    db.publishPlans.insert(base);
    db.publishPlans.insert({ ...base, id: 'pp2', status: 'published' });
    expect(db.publishPlans.pending()).toHaveLength(1);
  });

  it('decide approves or rejects and stamps decidedBy/decidedAt', () => {
    db.publishPlans.insert(base);
    db.publishPlans.decide('pp1', 'approved', 'local-ui');
    const row = db.publishPlans.byId('pp1');
    expect(row?.status).toBe('approved');
    expect(row?.decidedBy).toBe('local-ui');
  });

  it('markPublished / markFailed record the real outcome', () => {
    db.publishPlans.insert({ ...base, status: 'approved' });
    db.publishPlans.markPublished('pp1');
    expect(db.publishPlans.byId('pp1')?.status).toBe('published');

    db.publishPlans.insert({ ...base, id: 'pp3', status: 'approved' });
    db.publishPlans.markFailed('pp3', 'Zernio API key not configured');
    const row = db.publishPlans.byId('pp3');
    expect(row?.status).toBe('failed');
    expect(row?.failureReason).toBe('Zernio API key not configured');
  });

  it('byId returns null for an unknown id', () => {
    expect(db.publishPlans.byId('nope')).toBeNull();
  });
});
