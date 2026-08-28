import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDb } from '@/lib/db';

describe('routines + routineCompletions repos', () => {
  let db: ReturnType<typeof openDb>;
  beforeEach(() => { db = openDb(':memory:'); });
  afterEach(() => { (db as any).close?.(); });

  const now = new Date().toISOString();
  const base = { id: 'r1', title: 'Morning walk', frequency: 'daily' as const, active: true, createdAt: now };

  it('starts empty', () => {
    expect(db.routines.all()).toEqual([]);
    expect(db.routineCompletions.forRoutine('r1')).toEqual([]);
  });

  it('inserts and reads back a routine', () => {
    db.routines.insert(base);
    expect(db.routines.byId('r1')?.title).toBe('Morning walk');
  });

  it('active() lists only active routines', () => {
    db.routines.insert(base);
    db.routines.insert({ ...base, id: 'r2', active: false });
    expect(db.routines.active().map((r) => r.id)).toEqual(['r1']);
  });

  it('logs a completion — one per calendar day, append-only', () => {
    db.routines.insert(base);
    db.routineCompletions.insert({ id: 'c1', routineId: 'r1', completedOn: '2026-08-28', completedAt: now });
    const log = db.routineCompletions.forRoutine('r1');
    expect(log).toHaveLength(1);
    expect(log[0].completedOn).toBe('2026-08-28');
  });

  it('logging the same day twice does not duplicate the entry', () => {
    db.routines.insert(base);
    db.routineCompletions.insert({ id: 'c1', routineId: 'r1', completedOn: '2026-08-28', completedAt: now });
    db.routineCompletions.insert({ id: 'c2', routineId: 'r1', completedOn: '2026-08-28', completedAt: now });
    expect(db.routineCompletions.forRoutine('r1')).toHaveLength(1);
  });

  it('remove() deletes a routine', () => {
    db.routines.insert(base);
    db.routines.remove('r1');
    expect(db.routines.byId('r1')).toBeNull();
  });
});
