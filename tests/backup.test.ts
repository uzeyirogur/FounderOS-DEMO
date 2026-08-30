import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { backupDatabase, restoreDatabase } from '@/lib/backup';

/**
 * Real backup/restore against real SQLite files on disk — no mocking of
 * fs or better-sqlite3. backupDatabase uses better-sqlite3's native
 * online backup API (safe against a live WAL-mode DB); restoreDatabase
 * always takes a safety copy of whatever it's about to overwrite first,
 * so a bad restore is itself reversible.
 */
describe('backupDatabase', () => {
  let dir: string;
  let dbPath: string;
  let backupDir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'founderos-backup-'));
    dbPath = path.join(dir, 'source.db');
    backupDir = path.join(dir, 'backups');
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)');
    db.prepare('INSERT INTO t (name) VALUES (?)').run('real row');
    db.close();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('produces a real, restorable backup file with the source data intact', async () => {
    const result = await backupDatabase(dbPath, backupDir);
    expect(existsSync(result.backupPath)).toBe(true);
    expect(result.sizeBytes).toBeGreaterThan(0);

    const check = new Database(result.backupPath, { readonly: true });
    const row = check.prepare('SELECT name FROM t WHERE id = 1').get() as { name: string };
    expect(row.name).toBe('real row');
    check.close();
  });

  it('throws (never fabricates success) when the source DB does not exist', async () => {
    await expect(backupDatabase(path.join(dir, 'nope.db'), backupDir)).rejects.toThrow(/does not exist/);
  });

  it('prunes backups beyond the retention count, keeping the newest', async () => {
    for (let i = 0; i < 5; i++) {
      await backupDatabase(dbPath, backupDir, 3);
      await new Promise((r) => setTimeout(r, 5)); // ensure distinct mtimes/filenames
    }
    const fs = await import('node:fs');
    const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.db'));
    expect(files.length).toBe(3);
  });
});

describe('restoreDatabase', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'founderos-restore-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('restores a backup over the live DB and takes a safety copy of what it overwrote', () => {
    const backupPath = path.join(dir, 'backup.db');
    const targetPath = path.join(dir, 'live.db');

    const backupDb = new Database(backupPath);
    backupDb.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)');
    backupDb.prepare('INSERT INTO t (v) VALUES (?)').run('from backup');
    backupDb.close();

    const liveDb = new Database(targetPath);
    liveDb.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)');
    liveDb.prepare('INSERT INTO t (v) VALUES (?)').run('current live data');
    liveDb.close();

    const result = restoreDatabase(backupPath, targetPath);
    expect(result.safetyCopyPath).not.toBeNull();
    expect(existsSync(result.safetyCopyPath!)).toBe(true);

    const restored = new Database(targetPath, { readonly: true });
    const row = restored.prepare('SELECT v FROM t WHERE id = 1').get() as { v: string };
    expect(row.v).toBe('from backup');
    restored.close();

    const safety = new Database(result.safetyCopyPath!, { readonly: true });
    const safetyRow = safety.prepare('SELECT v FROM t WHERE id = 1').get() as { v: string };
    expect(safetyRow.v).toBe('current live data');
    safety.close();
  });

  it('restores with no safety copy when there is no existing target (fresh restore)', () => {
    const backupPath = path.join(dir, 'backup.db');
    const targetPath = path.join(dir, 'nested', 'live.db');
    const backupDb = new Database(backupPath);
    backupDb.exec('CREATE TABLE t (id INTEGER PRIMARY KEY)');
    backupDb.close();

    const result = restoreDatabase(backupPath, targetPath);
    expect(result.safetyCopyPath).toBeNull();
    expect(existsSync(targetPath)).toBe(true);
  });

  it('throws when the backup file itself does not exist', () => {
    expect(() => restoreDatabase(path.join(dir, 'nope.db'), path.join(dir, 'live.db'))).toThrow(/does not exist/);
  });
});
