import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openDb } from '@/lib/db';
import { discoverCapability } from '@/lib/capability-discovery';

/**
 * discoverCapability(db, capabilityTag, searchQuery, searchFn) — the shared
 * "don't just say I can't" flow every agent uses:
 *   1. check the registry first (byCapability) — if there is already an
 *      ACTIVE provider, return it immediately, no search needed
 *   2. otherwise run a real web search (injected so this is testable
 *      without hitting the network) for current options
 *   3. turn each result into a 'candidate' CapabilityProvider row and
 *      persist it to the registry (deduped by id, never duplicated)
 *   4. return what it found, tagged with whether anything is usable now
 *
 * searchFn is injected (not lib/connectors/web-search directly) so this
 * module has zero network dependency in tests, and so a caller can swap in
 * a different search backend later without touching this logic.
 */
describe('discoverCapability', () => {
  let db: ReturnType<typeof openDb>;

  beforeEach(() => {
    db = openDb(':memory:');
  });

  afterEach(() => {
    (db as any).close?.();
  });

  it('returns an existing ACTIVE provider without searching', async () => {
    db.capabilities.insert({
      id: 'brave-search',
      name: 'Brave Search API',
      capability: 'web-search',
      type: 'api',
      connector: 'lib/connectors/web-search.ts',
      authRequired: true,
      costModel: 'freemium',
      freeTier: '2,000/mo free',
      status: 'active',
      installed: true,
      configured: true,
      approvedByUser: true,
      allowedAgents: ['product-competitor-research'],
      notes: null,
      lastVerifiedAt: null,
    });
    const searchFn = vi.fn();
    const result = await discoverCapability(db, 'web-search', 'best web search api', searchFn);
    expect(result.readyNow).toBe(true);
    expect(result.active).toHaveLength(1);
    expect(searchFn).not.toHaveBeenCalled();
  });

  it('searches and inserts candidates when nothing active exists', async () => {
    const searchFn = vi.fn().mockResolvedValue([
      { title: 'Runway Gen-4 — AI video generation', url: 'https://runwayml.com/gen-4', description: 'Text-to-video AI, paid API.' },
      { title: 'Pika Labs video AI', url: 'https://pika.art', description: 'Free tier, video generation from text prompts.' },
    ]);
    const result = await discoverCapability(db, 'video-generation', 'AI video generation API 2026', searchFn);
    expect(searchFn).toHaveBeenCalledWith('AI video generation API 2026');
    expect(result.readyNow).toBe(false);
    expect(result.candidates).toHaveLength(2);
    const stored = db.capabilities.byCapability('video-generation');
    expect(stored).toHaveLength(2);
    expect(stored.every((c) => c.status === 'candidate')).toBe(true);
    expect(stored.every((c) => c.approvedByUser === false)).toBe(true);
  });

  it('does not duplicate a candidate already in the registry (same id)', async () => {
    const searchFn = vi.fn().mockResolvedValue([
      { title: 'Runway Gen-4', url: 'https://runwayml.com/gen-4', description: 'video gen' },
    ]);
    await discoverCapability(db, 'video-generation', 'q', searchFn);
    await discoverCapability(db, 'video-generation', 'q', searchFn);
    expect(db.capabilities.byCapability('video-generation')).toHaveLength(1);
  });

  it('guesses a paid cost model from "paid"/"subscription" language, free otherwise-worded results stay unknown', async () => {
    const searchFn = vi.fn().mockResolvedValue([
      { title: 'X', url: 'https://x.example/a', description: 'Paid subscription required, from $20/mo.' },
      { title: 'Y', url: 'https://y.example/b', description: 'Free and open source CLI tool.' },
    ]);
    const result = await discoverCapability(db, 'thing', 'q', searchFn);
    const paid = result.candidates.find((c) => c.connector?.includes('x.example'));
    const free = result.candidates.find((c) => c.connector?.includes('y.example'));
    expect(paid?.costModel).toBe('paid');
    expect(free?.costModel).toBe('free');
  });

  it('returns readyNow=false and empty candidates when search itself yields nothing', async () => {
    const searchFn = vi.fn().mockResolvedValue([]);
    const result = await discoverCapability(db, 'nonexistent-thing', 'q', searchFn);
    expect(result.readyNow).toBe(false);
    expect(result.candidates).toHaveLength(0);
  });

  it('surfaces a search failure honestly instead of pretending nothing was found', async () => {
    const searchFn = vi.fn().mockRejectedValue(new Error('BRAVE_SEARCH_API_KEY not set'));
    const result = await discoverCapability(db, 'thing', 'q', searchFn);
    expect(result.readyNow).toBe(false);
    expect(result.error).toMatch(/BRAVE_SEARCH_API_KEY/);
  });
});
