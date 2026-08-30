import path from 'node:path';
import { backupDatabase } from '../lib/backup';

/**
 * CLI wrapper for lib/backup.ts — run manually (`npm run backup`) or from
 * a scheduled job. Reads FOUNDER_OS_DB (same env var the app itself uses)
 * and FOUNDER_OS_BACKUP_DIR (defaults to data/backups next to the DB).
 */
async function main() {
  const dbPath = process.env.FOUNDER_OS_DB ?? path.join(process.cwd(), 'data', 'founder-os.db');
  const backupDir = process.env.FOUNDER_OS_BACKUP_DIR ?? path.join(path.dirname(dbPath), 'backups');
  const keep = process.env.FOUNDER_OS_BACKUP_KEEP ? Number(process.env.FOUNDER_OS_BACKUP_KEEP) : 14;

  try {
    const result = await backupDatabase(dbPath, backupDir, keep);
    console.log(`Backup OK: ${result.backupPath} (${result.sizeBytes} bytes) at ${result.createdAt}`);
    process.exitCode = 0;
  } catch (err) {
    console.error(`Backup FAILED: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}

main();
