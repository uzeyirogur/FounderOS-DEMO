import path from 'node:path';
import fs from 'node:fs';
import { restoreDatabase } from '../lib/backup';

/**
 * CLI wrapper for lib/backup.ts's restoreDatabase — `npm run restore --
 * <backup-file>` (or FOUNDER_OS_RESTORE_FROM=<path>). Requires an
 * explicit backup path; never guesses "the latest one" for a destructive
 * operation like this. Always takes a safety copy of whatever it
 * overwrites first (see restoreDatabase itself).
 */
async function main() {
  const backupPath = process.argv[2] || process.env.FOUNDER_OS_RESTORE_FROM;
  if (!backupPath) {
    console.error('Usage: npm run restore -- <path-to-backup.db>  (or set FOUNDER_OS_RESTORE_FROM)');
    process.exitCode = 1;
    return;
  }
  if (!fs.existsSync(backupPath)) {
    console.error(`Restore FAILED: backup file does not exist: ${backupPath}`);
    process.exitCode = 1;
    return;
  }
  const targetPath = process.env.FOUNDER_OS_DB ?? path.join(process.cwd(), 'data', 'founder-os.db');
  try {
    const result = restoreDatabase(backupPath, targetPath);
    console.log(`Restore OK: ${targetPath} restored from ${result.restoredFrom}`);
    if (result.safetyCopyPath) console.log(`  (previous live data saved to ${result.safetyCopyPath})`);
    process.exitCode = 0;
  } catch (err) {
    console.error(`Restore FAILED: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}

main();
