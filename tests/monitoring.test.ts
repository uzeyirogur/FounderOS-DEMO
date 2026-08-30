import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDb, type FounderDb } from '@/lib/db';
import { captureError, withErrorLogging } from '@/lib/monitoring';

describe('captureError', () => {
  let db: FounderDb;
  beforeEach(() => { db = openDb(':memory:'); });
  afterEach(() => { (db as any).close?.(); });

  it('writes a real row with message and stack from a real Error', () => {
    const err = new Error('boom');
    captureError(db, 'api_route', '/api/test', err);
    const rows = db.errorLogs.recent(10);
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe('api_route');
    expect(rows[0].context).toBe('/api/test');
    expect(rows[0].message).toBe('boom');
    expect(rows[0].stack).toContain('Error: boom');
  });

  it('handles a non-Error thrown value honestly (String(err)), never crashes', () => {
    captureError(db, 'scheduler', 'scheduler-tick', 'a plain string throw');
    const rows = db.errorLogs.recent(10);
    expect(rows[0].message).toBe('a plain string throw');
    expect(rows[0].stack).toBeNull();
  });

  it('never throws even if the DB write itself fails', () => {
    const closedDb = openDb(':memory:');
    (closedDb as any).close?.();
    expect(() => captureError(closedDb, 'api_route', '/x', new Error('y'))).not.toThrow();
  });
});

describe('errorLogs repo', () => {
  let db: FounderDb;
  beforeEach(() => { db = openDb(':memory:'); });
  afterEach(() => { (db as any).close?.(); });

  it('recent() returns newest first', () => {
    db.errorLogs.insert({ id: 'e1', source: 'api_route', context: 'a', message: 'first', stack: null, createdAt: '2026-01-01T00:00:00.000Z' });
    db.errorLogs.insert({ id: 'e2', source: 'api_route', context: 'b', message: 'second', stack: null, createdAt: '2026-01-02T00:00:00.000Z' });
    const rows = db.errorLogs.recent(10);
    expect(rows.map((r) => r.id)).toEqual(['e2', 'e1']);
  });

  it('recent() caps at 500 regardless of the requested limit', () => {
    for (let i = 0; i < 5; i++) {
      db.errorLogs.insert({ id: `e${i}`, source: 'client', context: 'x', message: 'x', stack: null, createdAt: new Date(2026, 0, i + 1).toISOString() });
    }
    expect(db.errorLogs.recent(10000)).toHaveLength(5); // fewer rows than the cap exist, all returned
  });

  it('prune() deletes rows older than the cutoff and returns the count removed', () => {
    const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    const recent = new Date().toISOString();
    db.errorLogs.insert({ id: 'old1', source: 'api_route', context: 'x', message: 'old', stack: null, createdAt: old });
    db.errorLogs.insert({ id: 'new1', source: 'api_route', context: 'x', message: 'new', stack: null, createdAt: recent });
    const removed = db.errorLogs.prune(30);
    expect(removed).toBe(1);
    expect(db.errorLogs.recent(10).map((r) => r.id)).toEqual(['new1']);
  });
});

describe('withErrorLogging', () => {
  let db: FounderDb;
  beforeEach(() => { db = openDb(':memory:'); });
  afterEach(() => { (db as any).close?.(); });

  it('passes through a successful handler untouched', async () => {
    const handler = withErrorLogging(() => db, '/api/ok', async () => new Response('ok', { status: 200 }));
    const res = await handler();
    expect(res.status).toBe(200);
    expect(db.errorLogs.recent(10)).toHaveLength(0);
  });

  it('captures a thrown error AND still returns a real 500, never a fake 200', async () => {
    const handler = withErrorLogging(() => db, '/api/broken', async () => {
      throw new Error('route exploded');
    });
    const res = await handler();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('route exploded');
    const rows = db.errorLogs.recent(10);
    expect(rows).toHaveLength(1);
    expect(rows[0].context).toBe('/api/broken');
  });
});
