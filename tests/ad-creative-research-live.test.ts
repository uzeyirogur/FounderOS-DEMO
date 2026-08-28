import { describe, it, expect, vi } from 'vitest';
import { openDb } from '@/lib/db';
import { runCreativeResearch } from '@/lib/ad-creative-research';

/**
 * runCreativeResearch(db, { projectId, format, query }, searchFn) —
 * same shape as Faz 4's Growth & Marketing: a real web search backs the
 * recommendation, never an invented opinion. Sources are the real result
 * URLs; a search failure propagates rather than being swallowed.
 */
describe('runCreativeResearch', () => {
  it('stores a real brief built from real search results', async () => {
    const db = openDb(':memory:');
    const searchFn = vi.fn().mockResolvedValue([
      { title: 'Vertical video ad formats 2026', url: 'https://x.com/a', description: 'Short-form vertical wins.' },
      { title: 'Carousel ad benchmarks', url: 'https://x.com/b', description: 'Carousels outperform static for B2C.' },
    ]);
    const brief = await runCreativeResearch(
      db,
      { projectId: 'proj1', format: 'short_video', query: 'best short-form ad creative formats 2026' },
      searchFn,
    );
    expect(searchFn).toHaveBeenCalledWith('best short-form ad creative formats 2026');
    expect(brief.format).toBe('short_video');
    expect(brief.sources).toHaveLength(2);
    expect(brief.recommendation).toContain('Vertical video ad formats 2026');
    expect(db.creativeBriefs.byProjectId('proj1')).toHaveLength(1);
    db.close();
  });

  it('is honest when the search returns nothing — never invents a recommendation', async () => {
    const db = openDb(':memory:');
    const brief = await runCreativeResearch(
      db,
      { projectId: 'proj1', format: 'carousel', query: 'obscure query' },
      vi.fn().mockResolvedValue([]),
    );
    expect(brief.recommendation).toMatch(/no results/i);
    expect(brief.sources).toEqual([]);
    db.close();
  });

  it('propagates a search failure rather than fabricating a brief', async () => {
    const db = openDb(':memory:');
    await expect(
      runCreativeResearch(db, { projectId: 'proj1', format: 'static_ad', query: 'q' }, vi.fn().mockRejectedValue(new Error('boom'))),
    ).rejects.toThrow('boom');
    expect(db.creativeBriefs.all()).toHaveLength(0);
    db.close();
  });
});
