import { randomUUID } from 'node:crypto';
import type { openDb } from '@/lib/db';
import type { ErrorLogSource } from '@/lib/schemas';

type Db = ReturnType<typeof openDb>;

/**
 * Real error capture — writes a real row to the error_logs table (see
 * lib/db.ts / lib/schemas.ts for why this is separate from agent_runs).
 * Never throws itself: a logging failure must never mask or replace the
 * original error it was trying to record. Deliberately does not persist
 * a raw request body/headers (could contain secrets/PII) — only the
 * error's own message/stack and a short context tag the caller chooses.
 */
export function captureError(db: Db, source: ErrorLogSource, context: string, err: unknown): void {
  try {
    db.errorLogs.insert({
      id: randomUUID(),
      source,
      context,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? (err.stack ?? null) : null,
      createdAt: new Date().toISOString(),
    });
  } catch {
    // Logging itself failing (e.g. DB unreachable) must never throw over
    // the original error — swallow silently, the original error still
    // propagates from wherever captureError was called.
  }
}

/**
 * Wraps a Next.js route handler so any exception it throws is captured
 * to error_logs AND still surfaces as a real 500 to the caller (never
 * swallowed into a fake 200) — a single call site route authors can wrap
 * their existing GET/POST/etc export with, instead of hand-writing a
 * try/catch in every route.
 */
export function withErrorLogging<Args extends unknown[]>(
  getDb: () => Db,
  context: string,
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      captureError(getDb(), 'api_route', context, err);
      const message = err instanceof Error ? err.message : String(err);
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
}
