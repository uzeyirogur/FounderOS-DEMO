import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

/**
 * Real, in-process backup trigger for a deployed host — see
 * docs/PRODUCTION_DEPLOYMENT.md's "remote backup" gap this closes.
 */
describe('POST /api/admin/backup', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'admin-backup-'));
  });
  afterEach(() => {
    delete process.env.FOUNDER_OS_DB;
    delete process.env.FOUNDER_OS_BACKUP_DIR;
    rmSync(dir, { recursive: true, force: true });
  });

  it('produces a real backup file from the real configured DB', async () => {
    const dbPath = path.join(dir, 'test.db');
    const db = new Database(dbPath);
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)');
    db.prepare('INSERT INTO t (v) VALUES (?)').run('real row');
    db.close();
    process.env.FOUNDER_OS_DB = dbPath;
    process.env.FOUNDER_OS_BACKUP_DIR = path.join(dir, 'backups');

    const { POST } = await import('@/app/api/admin/backup/route');
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.sizeBytes).toBeGreaterThan(0);

    const check = new Database(body.backupPath, { readonly: true });
    const row = check.prepare('SELECT v FROM t WHERE id = 1').get() as { v: string };
    expect(row.v).toBe('real row');
    check.close();
  });

  it('returns a real 500 with the real error when the source DB does not exist', async () => {
    process.env.FOUNDER_OS_DB = path.join(dir, 'does-not-exist.db');
    process.env.FOUNDER_OS_BACKUP_DIR = path.join(dir, 'backups');
    const { POST } = await import('@/app/api/admin/backup/route');
    const res = await POST();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/does not exist/);
  });
});
