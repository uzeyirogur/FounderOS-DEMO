import { NextResponse } from 'next/server';
import { getDb } from '@/lib/data';
import { captureError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

/**
 * Real client-side error intake — the only WRITE path into error_logs
 * that's reachable from a browser (app/error.tsx's Next.js error
 * boundary posts here). Always tagged source:'client' regardless of
 * what the request claims, so a browser can never spoof
 * source:'server_unhandled' or similar into the operator's monitoring
 * view. Body fields are read defensively (typeof checks) and never
 * trusted as pre-validated — this is the one endpoint on the whole app
 * a completely unauthenticated request (even behind the access gate,
 * a compromised/XSS'd browser tab counts) can reach.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const context = typeof body?.context === 'string' && body.context.length > 0 ? body.context.slice(0, 200) : 'unknown';
  const message = typeof body?.message === 'string' && body.message.length > 0 ? body.message.slice(0, 2000) : 'unknown client error';
  const stack = typeof body?.stack === 'string' ? body.stack.slice(0, 5000) : null;

  captureError(getDb(), 'client', context, stack ? Object.assign(new Error(message), { stack }) : message);
  return NextResponse.json({ ok: true });
}
