import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const startedAt = Date.now();

/**
 * Real liveness+readiness probe for a reverse-proxy/hosting platform
 * (Railway, a load balancer, uptime monitoring). Actually opens the real
 * DB singleton and runs a real query (agents.all()) — never a bare
 * `return 200` that would report "healthy" while the database underneath
 * is unreachable. Deliberately excluded from the access gate's matcher
 * (middleware.ts) so an unauthenticated probe is never itself blocked by
 * FOUNDER_OS_ACCESS_TOKEN — a probe getting 401 looks identical to "the
 * app is down" to most hosting platforms' health checks.
 */
export async function GET() {
  try {
    const { getDb } = await import('@/lib/data');
    const db = getDb();
    const agentCount = db.agents.all().length;
    return NextResponse.json({
      ok: true,
      db: 'connected',
      agentCount,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        db: 'unreachable',
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
