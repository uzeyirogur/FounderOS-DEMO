import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * Production go-live sprint item 5: a real health-check endpoint for the
 * reverse-proxy/host's liveness+readiness probe. Must be REAL — actually
 * touches the DB it depends on — never a bare `return 200` that says
 * "healthy" while the database underneath it is unreachable.
 *
 * Deliberately excluded from the access gate's matcher (see middleware.ts)
 * so a host's health-check probe (which sends no auth) is never itself
 * blocked by FOUNDER_OS_ACCESS_TOKEN — a probe that gets a 401 looks
 * identical to "the app is down" to most hosting platforms.
 */
describe('GET /api/health', () => {
  let dir: string;
  beforeEach(() => {
    vi.resetModules();
    dir = mkdtempSync(path.join(tmpdir(), 'health-check-'));
  });
  afterEach(() => {
    delete process.env.FOUNDER_OS_DB;
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns 200 with ok:true and real DB stats when the DB is reachable', async () => {
    process.env.FOUNDER_OS_DB = path.join(dir, 'test.db');
    const { GET } = await import('@/app/api/health/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.db).toBe('connected');
    expect(typeof body.agentCount).toBe('number');
    expect(body.agentCount).toBeGreaterThan(0);
    expect(typeof body.uptimeSeconds).toBe('number');
    expect(typeof body.timestamp).toBe('string');
    const { getDb } = await import('@/lib/data');
    (getDb() as any).close?.();
  });

  it('returns 503 with ok:false when the DB path is unreachable', async () => {
    // A path whose parent is a FILE, not a directory — openDb's mkdirSync
    // for the parent dir throws (ENOTDIR), a real unreachable-DB condition.
    const blockerFile = path.join(dir, 'not-a-directory.txt');
    writeFileSync(blockerFile, 'x');
    process.env.FOUNDER_OS_DB = path.join(blockerFile, 'nested', 'test.db');

    const { GET } = await import('@/app/api/health/route');
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(typeof body.error).toBe('string');
  });
});
