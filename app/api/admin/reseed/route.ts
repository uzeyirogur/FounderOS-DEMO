import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Real, in-process re-seed trigger for a deployed host. getDb() only ever
 * calls seedDatabase() once, on the very first touch when a table is empty
 * (see lib/data.ts) — so a text edit to lib/seed.ts (a role/description
 * Turkicized, a stale demo brand name removed) never reaches an
 * already-seeded database without an explicit re-seed. `npm run seed` does
 * this locally; this route is the equivalent for a deployed host with no
 * shell access to run it directly (same reasoning as /api/admin/backup —
 * opens the real configured DB path directly rather than going through the
 * getDb() singleton, so it behaves the same whether or not this process has
 * already touched the database).
 *
 * Safe to call on a live, already-seeded database: seedDatabase() upserts
 * every row via INSERT OR REPLACE keyed by its own seed id, so it only ever
 * refreshes text on rows it already owns — a user's own projects, tasks, and
 * notifications (real ids, never a seed id) are left untouched. Gated by the
 * same access-gate middleware every other route already has.
 */
export async function POST() {
  try {
    const path = await import('node:path');
    const { openDb } = await import('@/lib/db');
    const { seedDatabase } = await import('@/lib/seed');
    const dbPath = process.env.FOUNDER_OS_DB ?? path.join(process.cwd(), 'data', 'founder-os.db');
    const db = openDb(dbPath);
    try {
      seedDatabase(db);
      return NextResponse.json({
        ok: true,
        counts: {
          departments: db.departments.all().length,
          agents: db.agents.all().length,
          tools: db.tools.all().length,
          skills: db.skills.all().length,
          roadmap: db.roadmap.all().length,
        },
      });
    } finally {
      db.close();
    }
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
