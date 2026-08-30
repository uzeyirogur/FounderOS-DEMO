/**
 * Next.js server-startup hook (App Router). Runs once when the server
 * process boots, before it accepts requests.
 *
 * This file is loaded and statically analyzed by Next for BOTH the
 * Node.js and edge runtimes (this app has an edge middleware.ts, which
 * is what triggers edge analysis of instrumentation.ts too). Next's own
 * build tooling specifically recognizes the
 * `if (process.env.NEXT_RUNTIME === 'nodejs') { await import(...) }`
 * shape below and only bundles that import for the nodejs runtime — a
 * flatter `if (NEXT_RUNTIME !== 'nodejs') return; await import(...)`
 * shape does NOT get this treatment and a real build failure was hit
 * confirming it ("Module not found: Can't resolve 'stream'"/'crypto',
 * from imapflow/node:crypto pulled in transitively via
 * lib/agents/real.ts, when webpack tried to bundle those imports for
 * the edge runtime too).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node');
  }
}
