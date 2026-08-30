/**
 * Node.js-only half of instrumentation.ts's register() — see that file
 * for why this is split out. Wires the in-process scheduler
 * (lib/scheduler/in-process.ts) so the deployed host doesn't need an
 * external ticker hitting /api/scheduler/tick — gated behind
 * FOUNDER_OS_INPROCESS_SCHEDULER so local dev (which already has an
 * external Hermes cron doing this) is unaffected unless explicitly
 * opted in for a given deployment.
 */
import { inProcessSchedulerEnabled, startInProcessScheduler } from '@/lib/scheduler/in-process';

// Real process-level safety net: an uncaught exception or unhandled
// promise rejection anywhere in the server process is captured to the
// same error_logs sink the API routes use, instead of only crashing
// silently in the host's stdout (which most PaaS hosts do capture, but
// an in-app monitoring view — /monitoring — can't read host logs).
// Deliberately does NOT call process.exit() itself: an uncaught
// exception's default Node behavior (log + exit) is what the host's own
// restart policy (railway.json's restartPolicyType) is designed to
// catch and restart from; masking that here would hide real crashes
// instead of letting the host's crash-recovery do its job.
//
// Guarded by a global flag: `next dev`'s hot-reload can re-evaluate this
// module on file changes, and process-level listeners persist across
// that (they're on the real Node `process` object, not per-module-
// instance) — without the guard, every hot-reload would add ANOTHER
// pair of listeners, eventually tripping Node's own
// MaxListenersExceededWarning. Production has no hot-reload, so this
// only ever matters for local dev.
const g = globalThis as unknown as { __founderOsProcessHandlersRegistered?: boolean };
if (!g.__founderOsProcessHandlersRegistered) {
  g.__founderOsProcessHandlersRegistered = true;

  process.on('uncaughtException', async (err) => {
    try {
      const { getDb } = await import('@/lib/data');
      const { captureError } = await import('@/lib/monitoring');
      captureError(getDb(), 'server_unhandled', 'uncaughtException', err);
    } catch {
      // Never let error-logging itself compound the crash.
    }
    console.error('[uncaughtException]', err);
  });

  process.on('unhandledRejection', async (reason) => {
    try {
      const { getDb } = await import('@/lib/data');
      const { captureError } = await import('@/lib/monitoring');
      captureError(getDb(), 'server_unhandled', 'unhandledRejection', reason);
    } catch {
      // Never let error-logging itself compound the crash.
    }
    console.error('[unhandledRejection]', reason);
  });
}

if (inProcessSchedulerEnabled(process.env)) {
  const { getDb } = await import('@/lib/data');
  const { realAgents } = await import('@/lib/agents/real');
  const { captureError } = await import('@/lib/monitoring');
  const { runWhatsAppDeliveryTick } = await import('@/lib/whatsapp-delivery');

  const db = getDb();
  startInProcessScheduler(db, realAgents, {
    onTick: (result) => {
      if (result.fired.length > 0) {
        console.log(`[scheduler] tick fired: ${result.fired.join(', ')}`);
      }
      // Piggybacks the WhatsApp delivery sweep on the same tick cadence —
      // no separate interval needed. Honestly no-ops (skipped:non-null,
      // logged once) when WhatsApp isn't configured; a real send/fail is
      // logged per notification. See docs/WHATSAPP_CHANNEL_ARCHITECTURE.md.
      runWhatsAppDeliveryTick(db)
        .then((delivery) => {
          if (delivery.sent.length > 0) {
            console.log(`[whatsapp-delivery] sent ${delivery.sent.length} notification(s)`);
          }
          if (delivery.failed.length > 0) {
            console.error(`[whatsapp-delivery] ${delivery.failed.length} notification(s) failed:`, delivery.failed);
          }
        })
        .catch((err) => {
          captureError(db, 'scheduler', 'whatsapp-delivery-tick', err);
          console.error('[whatsapp-delivery] tick failed:', err instanceof Error ? err.message : String(err));
        });
    },
    onError: (err) => {
      captureError(db, 'scheduler', 'in-process-tick', err);
      console.error('[scheduler] tick failed:', err instanceof Error ? err.message : String(err));
    },
  });
  console.log('[scheduler] in-process scheduler started (FOUNDER_OS_INPROCESS_SCHEDULER=1)');
}
