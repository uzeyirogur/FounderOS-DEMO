/**
 * The scheduler engine. This is the "runner process" the demo's cron UI has
 * said is coming since Phase 5 (lib/cron.ts's original comment, roadmap item
 * rm-scheduler): reads every enabled cron, fires the ones isDue() says match
 * `now`, and runs the target agent through the exact same createRuntime().run()
 * path a manual dashboard click uses — one run history, one code path, no
 * parallel "scheduled run" concept to keep in sync.
 *
 * Deployment-agnostic by design: runSchedulerTick takes `now` as a parameter
 * and does one pass over due crons, then returns. It does not start its own
 * interval or own the clock. That means:
 *   - Today: an external ticker (a Hermes cronjob hitting POST
 *     /api/scheduler/tick once a minute) drives it, honestly labeled in the
 *     UI as "external ticker required" rather than claiming 24/7 uptime this
 *     machine cannot provide while it is off or asleep.
 *   - On the dedicated host: the same function is called from an in-process
 *     setInterval/BackgroundService-equivalent. Nothing about this file
 *     changes — only who calls it changes.
 */
import { createRuntime } from '@/lib/agents/runtime';
import type { RuntimeAgent } from '@/lib/agents/runtime';
import type { FounderDb } from '@/lib/db';
import { isDue } from '@/lib/cron';

export type SchedulerTickResult = {
  checkedAt: string;
  fired: string[]; // cron ids that ran this tick
  skipped: { cronId: string; reason: string }[]; // due crons that could not run (unknown agent, etc.)
};

/**
 * Run one scheduler pass: fire every enabled cron that isDue() says matches
 * `now` and has not already fired for this minute. Each firing cron's agent
 * runs through the shared runtime (same run-history table, same failure
 * handling as a manual run) and its lastRunAt is stamped so a second tick
 * inside the same matching minute is a no-op.
 */
export async function runSchedulerTick(
  db: FounderDb,
  agents: RuntimeAgent[],
  now: Date = new Date(),
): Promise<SchedulerTickResult> {
  const runtime = createRuntime(db, agents);
  const fired: string[] = [];
  const skipped: { cronId: string; reason: string }[] = [];

  for (const cron of db.agentCrons.allEnabled()) {
    if (!isDue(cron.schedule, now, cron.lastRunAt)) continue;
    // Re-read + re-check against the FRESHEST lastRunAt right before
    // claiming, not the snapshot allEnabled() took at the top of this
    // tick — a concurrent tick (two overlapping external-ticker calls, or
    // a tick still mid-flight when the next one starts) may have already
    // claimed this cron in the meantime. This re-check-and-claim runs
    // synchronously (better-sqlite3 is sync), so no other tick's own
    // synchronous re-check-and-claim can interleave inside it — only the
    // `await runtime.run()` below can yield. Claiming (stamping
    // lastRunAt) BEFORE awaiting the run, not after, is what closes the
    // window: a concurrent tick's re-check now sees the claim immediately,
    // instead of only after the whole run finishes.
    const fresh = db.agentCrons.byId(cron.id);
    if (!fresh || !fresh.enabled || !isDue(fresh.schedule, now, fresh.lastRunAt)) continue;
    db.agentCrons.setLastRunAt(cron.id, now.toISOString());
    try {
      await runtime.run(cron.agentId);
      fired.push(cron.id);
    } catch (err) {
      // runtime.run() itself only throws for an unknown agent id (a throwing
      // agent.run() is already caught inside runtime.run and recorded as a
      // failed AgentRun) — record that as skipped rather than aborting the
      // whole tick, so one misconfigured cron cannot block every other one.
      skipped.push({ cronId: cron.id, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  return { checkedAt: now.toISOString(), fired, skipped };
}
