import { runSchedulerTick, type SchedulerTickResult } from '@/lib/scheduler/tick';
import type { FounderDb } from '@/lib/db';
import type { RuntimeAgent } from '@/lib/agents/runtime';

/**
 * Production go-live sprint: the scheduler must keep running on a
 * deployed host with nobody's laptop or Hermes session involved. Today
 * (local dev) an external ticker (a Hermes cronjob) POSTs
 * /api/scheduler/tick once a minute — that only works while the
 * developer's machine is on. This module lets the SAME runSchedulerTick
 * function be driven by an in-process interval instead, so as long as
 * the Next.js server itself is running (which the host's own restart
 * policy keeps true), the scheduler runs too — no external caller needed.
 *
 * Wired from instrumentation.ts (Next's official server-startup hook),
 * gated behind FOUNDER_OS_INPROCESS_SCHEDULER so it never double-fires
 * against an existing external ticker setup (e.g. this repo's own local
 * dev environment, which already has a Hermes cron hitting the HTTP
 * route) unless explicitly turned on for a given deployment.
 */
export interface InProcessSchedulerHandle {
  stop: () => void;
  tickCount: number;
  lastResult: SchedulerTickResult | null;
  lastError: string | null;
}

export interface InProcessSchedulerOptions {
  intervalMs?: number;
  onTick?: (result: SchedulerTickResult) => void;
  onError?: (err: unknown) => void;
}

/**
 * Starts a self-driving interval that calls runSchedulerTick against the
 * given db/agents every intervalMs (default 60s, matching the external
 * ticker's cadence). Overlap-safe: if a tick is still running when the
 * next interval fires, that fire is skipped rather than queuing a second
 * concurrent tick (runSchedulerTick itself is also concurrency-safe per
 * its own re-check-and-claim logic, but skipping avoids pointless
 * overlapping work). A tick that throws is caught and reported via
 * onError — it can never crash the whole server process.
 */
export function startInProcessScheduler(
  db: FounderDb,
  agents: RuntimeAgent[],
  options: InProcessSchedulerOptions = {},
): InProcessSchedulerHandle {
  const intervalMs = options.intervalMs ?? 60_000;
  const handle: InProcessSchedulerHandle = {
    stop: () => {},
    tickCount: 0,
    lastResult: null,
    lastError: null,
  };

  let inFlight = false;
  const timer = setInterval(() => {
    if (inFlight) return; // previous tick still running — skip this fire
    inFlight = true;
    Promise.resolve(runSchedulerTick(db, agents, new Date()))
      .then((result) => {
        handle.tickCount += 1;
        handle.lastResult = result;
        handle.lastError = null;
        options.onTick?.(result);
      })
      .catch((err) => {
        handle.lastError = err instanceof Error ? err.message : String(err);
        options.onError?.(err);
      })
      .finally(() => {
        inFlight = false;
      });
  }, intervalMs);

  // Node keeps the process alive while a timer is pending by default,
  // which is exactly what a long-running server wants — but unref isn't
  // called, so this timer participates in that normal keep-alive.
  handle.stop = () => clearInterval(timer);
  return handle;
}

/** Whether the in-process scheduler should start for this deployment.
 *  Pure so it's testable without touching a real interval/timer. */
export function inProcessSchedulerEnabled(env: Record<string, string | undefined>): boolean {
  return env.FOUNDER_OS_INPROCESS_SCHEDULER === '1' || env.FOUNDER_OS_INPROCESS_SCHEDULER === 'true';
}
