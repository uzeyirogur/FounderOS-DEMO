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

if (inProcessSchedulerEnabled(process.env)) {
  const { getDb } = await import('@/lib/data');
  const { realAgents } = await import('@/lib/agents/real');

  const db = getDb();
  startInProcessScheduler(db, realAgents, {
    onTick: (result) => {
      if (result.fired.length > 0) {
        console.log(`[scheduler] tick fired: ${result.fired.join(', ')}`);
      }
    },
    onError: (err) => {
      console.error('[scheduler] tick failed:', err instanceof Error ? err.message : String(err));
    },
  });
  console.log('[scheduler] in-process scheduler started (FOUNDER_OS_INPROCESS_SCHEDULER=1)');
}
