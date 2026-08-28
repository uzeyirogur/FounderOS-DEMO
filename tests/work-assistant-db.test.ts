import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDb } from '@/lib/db';

describe('personalTasks repo', () => {
  let db: ReturnType<typeof openDb>;
  beforeEach(() => { db = openDb(':memory:'); });
  afterEach(() => { (db as any).close?.(); });

  const now = new Date().toISOString();
  const base = { id: 'pt1', title: 'Call the accountant', dueAt: null, priority: 'normal' as const, status: 'open' as const, createdAt: now, completedAt: null };

  it('starts empty', () => {
    expect(db.personalTasks.all()).toEqual([]);
  });

  it('inserts and reads back', () => {
    db.personalTasks.insert(base);
    expect(db.personalTasks.byId('pt1')?.title).toBe('Call the accountant');
  });

  it('open() lists only status open, sorted by priority then dueAt', () => {
    db.personalTasks.insert({ ...base, id: 'pt1', priority: 'low' });
    db.personalTasks.insert({ ...base, id: 'pt2', priority: 'high' });
    db.personalTasks.insert({ ...base, id: 'pt3', status: 'done' });
    const open = db.personalTasks.open();
    expect(open.map((t) => t.id)).toEqual(['pt2', 'pt1']);
  });

  it('complete() sets status done and completedAt', () => {
    db.personalTasks.insert(base);
    db.personalTasks.complete('pt1');
    const row = db.personalTasks.byId('pt1');
    expect(row?.status).toBe('done');
    expect(row?.completedAt).not.toBeNull();
  });

  it('remove() deletes it', () => {
    db.personalTasks.insert(base);
    db.personalTasks.remove('pt1');
    expect(db.personalTasks.byId('pt1')).toBeNull();
  });
});
