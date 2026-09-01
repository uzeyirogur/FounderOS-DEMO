import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDb } from '@/lib/db';

/**
 * Real, in-process re-seed trigger for a deployed host. getDb() only calls
 * seedDatabase() when a table is empty (see lib/data.ts) — so a text change
 * to lib/seed.ts (e.g. Turkicizing an agent's description) never reaches an
 * already-seeded database (local dev's data/founder-os.db, or the real
 * production volume) without an explicit re-seed. `npm run seed` does this
 * locally; this route is the equivalent for the deployed host where there is
 * no shell access to run it directly (mirrors /api/admin/backup's reasoning).
 *
 * seedDatabase() itself is INSERT OR REPLACE by id, so re-running it is safe:
 * user-created rows (their own projects, tasks, notifications) are untouched
 * because they don't share a seed id, and seeded rows get their text updated
 * in place without disturbing anything else in the database.
 */
describe('POST /api/admin/reseed', () => {
  let dir: string;
  afterEach(() => {
    delete process.env.FOUNDER_OS_DB;
    rmSync(dir, { recursive: true, force: true });
  });

  it('re-runs seedDatabase against the real configured DB and updates existing seeded text', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'admin-reseed-'));
    const dbPath = path.join(dir, 'test.db');
    process.env.FOUNDER_OS_DB = dbPath;

    // First touch seeds it (mirrors a real already-seeded deployment).
    const db = openDb(dbPath);
    const { seedDatabase } = await import('@/lib/seed');
    seedDatabase(db);
    const before = db.agents.all().find((a) => a.id === 'conductor')!;
    expect(before.role).toBe('Yayın ve Orkestrasyon');
    db.close();

    const { POST } = await import('@/app/api/admin/reseed/route');
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.counts.agents).toBeGreaterThan(0);

    const after = openDb(dbPath);
    const agent = after.agents.all().find((a) => a.id === 'conductor')!;
    expect(agent.role).toBe('Yayın ve Orkestrasyon');
    after.close();
  });

  it('never deletes user-created rows outside the seed id set', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'admin-reseed-user-'));
    const dbPath = path.join(dir, 'test.db');
    process.env.FOUNDER_OS_DB = dbPath;

    const db = openDb(dbPath);
    const { seedDatabase } = await import('@/lib/seed');
    seedDatabase(db);
    db.projects.insert({
      id: 'my-real-project',
      name: 'My Real Project',
      kind: 'local',
      pathOrUrl: 'C:/real/path',
      purpose: 'a real user project',
      status: 'active',
      permissionLevel: 'read_only',
      authorizedAgentIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      origin: 'os',
    });
    db.close();

    const { POST } = await import('@/app/api/admin/reseed/route');
    const res = await POST();
    expect(res.status).toBe(200);

    const after = openDb(dbPath);
    expect(after.projects.byId('my-real-project')).not.toBeNull();
    after.close();
  });

  it('returns a real 500 with the real error when the source DB path is unusable', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'admin-reseed-bad-'));
    process.env.FOUNDER_OS_DB = path.join(dir, 'does', 'not', 'exist', 'test.db');
    const { POST } = await import('@/app/api/admin/reseed/route');
    const res = await POST();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(typeof body.error).toBe('string');
  });
});
