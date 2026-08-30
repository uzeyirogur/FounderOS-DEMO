import { NextResponse } from 'next/server';
import { getDb } from '@/lib/data';

export const dynamic = 'force-dynamic';

/**
 * Real production error log — the operational health view. Read-only:
 * error rows are written by lib/monitoring.ts's captureError (API route
 * failures, scheduler tick failures, uncaught process exceptions) and by
 * the client-side reporter (see components/ClientErrorReporter.tsx) for
 * React render errors. Never fabricates "0 errors" — an empty array here
 * genuinely means nothing has been captured since the process started
 * (or since the last prune).
 */
export async function GET(req: Request) {
  const db = getDb();
  const url = new URL(req.url);
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Number(limitParam) : 100;
  const logs = db.errorLogs.recent(Number.isFinite(limit) && limit > 0 ? limit : 100);
  return NextResponse.json({ logs, count: logs.length });
}
