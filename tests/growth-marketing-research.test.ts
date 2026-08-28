import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openDb } from '@/lib/db';
import { runGrowthResearch } from '@/lib/growth-marketing';

/** runGrowthResearch(db, { projectId, focus, query }, searchFn) — real web
 *  research (injected search fn), persisted as a GrowthBrief with real
 *  sources. Never invents findings; a search failure is surfaced honestly. */
describe('runGrowthResearch', () => {
  let db: ReturnType<typeof openDb>;
  beforeEach(() => { db = openDb(':memory:'); });
  afterEach(() => { (db as any).close?.(); });

  it('runs a real search and persists a brief with real sources', async () => {
    const searchFn = vi.fn().mockResolvedValue([
      { title: 'Competitor A', url: 'https://a.example', description: 'A youth sports app in Turkey.' },
      { title: 'Competitor B', url: 'https://b.example', description: 'Another one.' },
    ]);
    const brief = await runGrowthResearch(
      db,
      { projectId: 'anka-tivaro', focus: 'competitor', query: 'youth basketball app competitors Turkey' },
      searchFn,
    );
    expect(brief.projectId).toBe('anka-tivaro');
    expect(brief.focus).toBe('competitor');
    expect(brief.sources).toHaveLength(2);
    expect(brief.findings).toMatch(/Competitor A/);
    const stored = db.growthBriefs.byProjectId('anka-tivaro');
    expect(stored).toHaveLength(1);
  });

  it('surfaces a search failure honestly rather than inventing findings', async () => {
    const searchFn = vi.fn().mockRejectedValue(new Error('BRAVE_SEARCH_API_KEY not set'));
    await expect(
      runGrowthResearch(db, { projectId: 'anka-tivaro', focus: 'seo', query: 'x' }, searchFn),
    ).rejects.toThrow(/BRAVE_SEARCH_API_KEY/);
    expect(db.growthBriefs.byProjectId('anka-tivaro')).toHaveLength(0);
  });

  it('handles zero search results without fabricating a finding', async () => {
    const searchFn = vi.fn().mockResolvedValue([]);
    const brief = await runGrowthResearch(db, { projectId: 'p', focus: 'seo', query: 'x' }, searchFn);
    expect(brief.sources).toHaveLength(0);
    expect(brief.findings).toMatch(/no results/i);
  });
});
