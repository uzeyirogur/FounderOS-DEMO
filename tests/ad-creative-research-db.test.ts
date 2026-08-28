import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDb } from '@/lib/db';

describe('creativeBriefs repo', () => {
  let db: ReturnType<typeof openDb>;
  beforeEach(() => { db = openDb(':memory:'); });
  afterEach(() => { db.close(); });

  it('inserts and reads back a brief', () => {
    db.creativeBriefs.insert({
      id: 'cb1', projectId: 'proj1', format: 'short_video', query: 'q', recommendation: 'r',
      sources: [{ title: 't', url: 'https://x.com' }], createdAt: new Date().toISOString(),
    });
    const all = db.creativeBriefs.all();
    expect(all).toHaveLength(1);
    expect(all[0].sources[0].title).toBe('t');
  });

  it('filters by project', () => {
    db.creativeBriefs.insert({ id: 'cb1', projectId: 'proj1', format: 'carousel', query: 'q', recommendation: 'r', sources: [], createdAt: new Date().toISOString() });
    db.creativeBriefs.insert({ id: 'cb2', projectId: 'proj2', format: 'carousel', query: 'q', recommendation: 'r', sources: [], createdAt: new Date().toISOString() });
    expect(db.creativeBriefs.byProjectId('proj1')).toHaveLength(1);
  });
});
