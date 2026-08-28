import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDb } from '@/lib/db';
import { aggregateStatus } from '@/lib/conductor';

/**
 * Chief of Staff v2's real cross-system status aggregation: every pending
 * approval and blocker across every real domain this session built —
 * lifecycle approvals, publish plans, outbound messages, capability
 * candidates, content pieces stuck needing a capability. All read directly
 * from the real repos; nothing here is invented or hardcoded to one project.
 */
describe('aggregateStatus', () => {
  let db: ReturnType<typeof openDb>;
  beforeEach(() => { db = openDb(':memory:'); });
  afterEach(() => { db.close(); });

  it('is all-clear on an empty database', () => {
    const status = aggregateStatus(db);
    expect(status.pendingLifecycleApprovals).toBe(0);
    expect(status.pendingPublishPlans).toBe(0);
    expect(status.pendingOutboundMessages).toBe(0);
    expect(status.candidateCapabilities).toBe(0);
    expect(status.blockedContentPieces).toBe(0);
    expect(status.totalBlockers).toBe(0);
  });

  it('counts a pending lifecycle approval as a real blocker', () => {
    db.lifecycleApprovals.insert({
      id: 'a1', projectId: 'p1', phase: 'deployment_approval', title: 't', description: '',
      requestedByAgentId: 'x', status: 'pending', createdAt: new Date().toISOString(), decidedAt: null, decidedBy: null, notes: null,
    } as any);
    const status = aggregateStatus(db);
    expect(status.pendingLifecycleApprovals).toBe(1);
    expect(status.totalBlockers).toBe(1);
  });

  it('counts a pending publish plan and a pending outbound message', () => {
    db.publishPlans.insert({
      id: 'pp1', projectId: null, contentPieceId: 'c1', platforms: ['instagram'], caption: 'x',
      adaptations: [], status: 'pending_approval', createdAt: new Date().toISOString(), publishedAt: null, failureReason: null,
    } as any);
    db.outboundMessages.insert({
      id: 'om1', channel: 'email', to: 'a@b.com', subject: null, body: 'x',
      status: 'pending_approval', createdAt: new Date().toISOString(), sentAt: null, failureReason: null,
    } as any);
    const status = aggregateStatus(db);
    expect(status.pendingPublishPlans).toBe(1);
    expect(status.pendingOutboundMessages).toBe(1);
    expect(status.totalBlockers).toBe(2);
  });

  it('counts a candidate capability awaiting user approval', () => {
    db.capabilities.insert({
      id: 'cap1', name: 'x', capability: 'video-generation', type: 'api', connector: null,
      authRequired: true, costModel: 'paid', freeTier: null, status: 'candidate', installed: false,
      configured: false, approvedByUser: false, allowedAgents: [], notes: null, lastVerifiedAt: null,
    } as any);
    const status = aggregateStatus(db);
    expect(status.candidateCapabilities).toBe(1);
    expect(status.totalBlockers).toBe(1);
  });

  it('counts a content piece stuck needing a capability', () => {
    db.contentPieces.insert({
      id: 'cp1', projectId: null, kind: 'product_demo_video', brief: 'x', status: 'needs_capability',
      output: null, requiredCapability: 'video-generation', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    } as any);
    const status = aggregateStatus(db);
    expect(status.blockedContentPieces).toBe(1);
    expect(status.totalBlockers).toBe(1);
  });
});
