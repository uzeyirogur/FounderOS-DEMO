import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDb } from '@/lib/db';

/** DB-layer tests for the Capability Registry repo — same
 *  openDb(':memory:') + db.close() convention as the rest of the repo. */
describe('capabilities repo', () => {
  let db: ReturnType<typeof openDb>;

  beforeEach(() => {
    db = openDb(':memory:');
  });

  afterEach(() => {
    (db as any).close?.();
  });

  const brave = {
    id: 'brave-search',
    name: 'Brave Search API',
    capability: 'web-search',
    type: 'api' as const,
    connector: 'lib/connectors/web-search.ts',
    authRequired: true,
    costModel: 'freemium' as const,
    freeTier: '2,000 queries/month free',
    status: 'active' as const,
    installed: true,
    configured: true,
    approvedByUser: true,
    allowedAgents: ['product-competitor-research'],
    notes: null,
    lastVerifiedAt: null,
  };

  it('insert + all round-trips a provider', () => {
    db.capabilities.insert(brave);
    const rows = db.capabilities.all();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Brave Search API');
    expect(rows[0].allowedAgents).toEqual(['product-competitor-research']);
  });

  it('byCapability filters by the capability tag', () => {
    db.capabilities.insert(brave);
    db.capabilities.insert({ ...brave, id: 'other', capability: 'video-generation' });
    expect(db.capabilities.byCapability('web-search')).toHaveLength(1);
    expect(db.capabilities.byCapability('video-generation')).toHaveLength(1);
    expect(db.capabilities.byCapability('nonexistent')).toHaveLength(0);
  });

  it('byId returns null for an unknown id', () => {
    expect(db.capabilities.byId('nope')).toBeNull();
  });

  it('approve flips approvedByUser, status to active, and records allowedAgents', () => {
    db.capabilities.insert({ ...brave, status: 'candidate', approvedByUser: false, allowedAgents: [] });
    db.capabilities.approve('brave-search', ['product-competitor-research', 'social-content-studio']);
    const row = db.capabilities.byId('brave-search');
    expect(row?.approvedByUser).toBe(true);
    expect(row?.status).toBe('active');
    expect(row?.allowedAgents).toEqual(['product-competitor-research', 'social-content-studio']);
  });

  it('reject sets status to rejected without touching approvedByUser', () => {
    db.capabilities.insert({ ...brave, status: 'candidate', approvedByUser: false });
    db.capabilities.reject('brave-search', 'too expensive for now');
    const row = db.capabilities.byId('brave-search');
    expect(row?.status).toBe('rejected');
    expect(row?.approvedByUser).toBe(false);
    expect(row?.notes).toBe('too expensive for now');
  });

  it('pendingApproval lists only paid/auth-required candidates awaiting a decision', () => {
    db.capabilities.insert({ ...brave, id: 'free-one', costModel: 'free', authRequired: false, status: 'candidate' });
    db.capabilities.insert({ ...brave, id: 'paid-one', costModel: 'paid', authRequired: true, status: 'candidate' });
    const pending = db.capabilities.pendingApproval();
    expect(pending.map((p) => p.id)).toEqual(['paid-one']);
  });
});
