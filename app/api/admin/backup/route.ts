import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Real, in-process backup trigger — a working remote-backup path for a
 * deployed host where `railway ssh` (or an equivalent) is unreliable/slow
 * to connect (see docs/PRODUCTION_DEPLOYMENT.md's "remote backup" gap).
 * Runs the exact same backupDatabase() the CLI script uses, against the
 * real FOUNDER_OS_DB path, writing into a backups/ directory next to it
 * on the SAME persistent volume — this does not stream the file off the
 * host, it just proves the backup mechanism works against the real
 * production DB and leaves a real artifact on the volume. Gated by the
 * same access-gate middleware every other route already has (this file
 * adds no separate auth) — a mutating-adjacent operation (writes a real
 * file) must never be reachable unauthenticated.
 */
export async function POST() {
  try {
    const path = await import('node:path');
    const { backupDatabase } = await import('@/lib/backup');
    const dbPath = process.env.FOUNDER_OS_DB ?? path.join(process.cwd(), 'data', 'founder-os.db');
    const backupDir = process.env.FOUNDER_OS_BACKUP_DIR ?? path.join(path.dirname(dbPath), 'backups');
    const keep = process.env.FOUNDER_OS_BACKUP_KEEP ? Number(process.env.FOUNDER_OS_BACKUP_KEEP) : 14;
    const result = await backupDatabase(dbPath, backupDir, keep);
    return NextResponse.json({ ok: true, backupPath: result.backupPath, sizeBytes: result.sizeBytes, createdAt: result.createdAt });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
