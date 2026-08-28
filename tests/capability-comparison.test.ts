import { describe, it, expect } from 'vitest';
import { compareCandidates, type CandidateComparison } from '@/lib/capability-comparison';
import type { CapabilityProvider } from '@/lib/schemas';

function candidate(overrides: Partial<CapabilityProvider>): CapabilityProvider {
  return {
    id: 'c1', name: 'Tool A', capability: 'video-generation', type: 'hosted_service', connector: 'https://a.com',
    authRequired: true, costModel: 'unknown', freeTier: null, status: 'candidate', installed: false,
    configured: false, approvedByUser: false, allowedAgents: [], notes: null, lastVerifiedAt: null,
    ...overrides,
  };
}

/**
 * The overnight plan asks AI Intelligence to compare 2-3 discovered
 * solutions on: quality signal, API/MCP availability, automation
 * suitability, pricing, free tier, limits, license, local/cloud,
 * credential requirement, integration complexity. This scores REAL
 * CapabilityProvider fields — never invents data the row doesn't have —
 * and is deliberately transparent (every score traces to a real field).
 */
describe('compareCandidates', () => {
  it('ranks a free, no-auth candidate above a paid, auth-required one', () => {
    const free = candidate({ id: 'free1', costModel: 'free', authRequired: false, freeTier: 'unlimited' });
    const paid = candidate({ id: 'paid1', costModel: 'paid', authRequired: true });
    const [top] = compareCandidates([paid, free]);
    expect(top.id).toBe('free1');
  });

  it('ranks an MCP-type candidate above a hosted_service for automation suitability', () => {
    const mcp = candidate({ id: 'mcp1', type: 'mcp_server' });
    const hosted = candidate({ id: 'hosted1', type: 'hosted_service' });
    const [top] = compareCandidates([hosted, mcp]);
    expect(top.id).toBe('mcp1');
  });

  it('every comparison row carries the real fields the plan asks for, no invented data', () => {
    const c = candidate({ costModel: 'freemium', freeTier: '5 videos/mo', authRequired: true, type: 'api' });
    const [result] = compareCandidates([c]);
    const keys: (keyof CandidateComparison)[] = [
      'id', 'name', 'capability', 'type', 'costModel', 'freeTier',
      'authRequired', 'score', 'scoreBreakdown',
    ];
    for (const k of keys) expect(result).toHaveProperty(k);
    expect(result.costModel).toBe('freemium');
    expect(result.freeTier).toBe('5 videos/mo');
  });

  it('caps the comparison at the top 3 candidates, sorted best first', () => {
    const candidates = [
      candidate({ id: 'a', costModel: 'paid' }),
      candidate({ id: 'b', costModel: 'free', authRequired: false }),
      candidate({ id: 'c', costModel: 'unknown' }),
      candidate({ id: 'd', costModel: 'paid', authRequired: true }),
    ];
    const result = compareCandidates(candidates);
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('b'); // free + no auth scores highest
  });

  it('returns an empty array for no candidates, never throws', () => {
    expect(compareCandidates([])).toEqual([]);
  });
});
