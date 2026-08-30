import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';

/**
 * Real SQLite backup using better-sqlite3's native online backup API
 * (db.backup()) — safe to run against a live, WAL-mode database with the
 * app still serving traffic (unlike a raw file copy, which can capture a
 * torn/inconsistent snapshot mid-write). Never fabricates a backup: a
 * failure throws, it never silently reports success.
 *
 * Retention: keeps the most recent `keep` backups in the target directory
 * and deletes older ones, so backups never grow unbounded on a small
 * persistent volume.
 */
export interface BackupResult {
  sourcePath: string;
  backupPath: string;
  sizeBytes: number;
  createdAt: string;
}

export async function backupDatabase(sourceDbPath: string, backupDir: string, keep = 14): Promise<BackupResult> {
  if (!fs.existsSync(sourceDbPath)) {
    throw new Error(`backupDatabase: source database does not exist: ${sourceDbPath}`);
  }
  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `founder-os-${timestamp}.db`);

  const db = new Database(sourceDbPath, { readonly: true, fileMustExist: true });
  try {
    await db.backup(backupPath);
  } finally {
    db.close();
  }

  const sizeBytes = fs.statSync(backupPath).size;

  // Retention: prune older backups beyond `keep`, oldest first.
  const existing = fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith('founder-os-') && f.endsWith('.db'))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(backupDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  for (const stale of existing.slice(keep)) {
    fs.unlinkSync(path.join(backupDir, stale.name));
  }

  return { sourcePath: sourceDbPath, backupPath, sizeBytes, createdAt: new Date().toISOString() };
}

/**
 * Restores a backup file over the live database path. Refuses to
 * overwrite a live DB without an explicit safety copy of the current
 * state first (so a bad restore is itself reversible) — never a blind
 * overwrite of production data.
 */
export function restoreDatabase(backupPath: string, targetDbPath: string): { restoredFrom: string; safetyCopyPath: string | null } {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`restoreDatabase: backup file does not exist: ${backupPath}`);
  }
  let safetyCopyPath: string | null = null;
  if (fs.existsSync(targetDbPath)) {
    safetyCopyPath = `${targetDbPath}.pre-restore-${Date.now()}.bak`;
    fs.copyFileSync(targetDbPath, safetyCopyPath);
  }
  fs.mkdirSync(path.dirname(targetDbPath), { recursive: true });
  fs.copyFileSync(backupPath, targetDbPath);
  // Drop any stale WAL/SHM sidecar files from the old DB state so the
  // restored file is read fresh, not merged with leftover WAL frames.
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = `${targetDbPath}${suffix}`;
    if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
  }
  return { restoredFrom: backupPath, safetyCopyPath };
}
