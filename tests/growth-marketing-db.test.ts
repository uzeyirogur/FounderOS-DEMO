import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDb } from '@/lib/db';

describe('growthBriefs repo', () => {
  let db: ReturnType<typeof openDb>;
  beforeEach(() => { db = openDb(':memory:'); });
  afterEach(() => { (db as any).close?.(); });

  const now = new Date().toISOString();

  it('insert + all round-trips a brief, including sources', () => {
    db.growthBriefs.insert({
      id: 'g1', projectId: 'anka-tivaro', focus: 'competitor', query: 'q', findings: 'f',
      sources: [{ title: 'X', url: 'https://x.example' }], createdAt: now,
    });
    const rows = db.growthBriefs.all();
    expect(rows).toHaveLength(1);
    expect(rows[0].sources).toEqual([{ title: 'X', url: 'https://x.example' }]);
  });

  it('byProjectId filters to one project', () => {
    db.growthBriefs.insert({ id: 'g1', projectId: 'proj-a', focus: 'seo', query: 'q', findings: 'f', sources: [], createdAt: now });
    db.growthBriefs.insert({ id: 'g2', projectId: 'proj-b', focus: 'seo', query: 'q', findings: 'f', sources: [], createdAt: now });
    expect(db.growthBriefs.byProjectId('proj-a')).toHaveLength(1);
  });

  it('byFocus filters by focus area', () => {
    db.growthBriefs.insert({ id: 'g1', projectId: 'proj-a', focus: 'competitor', query: 'q', findings: 'f', sources: [], createdAt: now });
    db.growthBriefs.insert({ id: 'g2', projectId: 'proj-a', focus: 'seo', query: 'q', findings: 'f', sources: [], createdAt: now });
    expect(db.growthBriefs.byFocus('proj-a', 'competitor')).toHaveLength(1);
  });
});
