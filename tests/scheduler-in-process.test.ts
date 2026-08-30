import { describe, it, expect, afterEach, vi } from 'vitest';
import { openDb, type FounderDb } from '@/lib/db';
import { startInProcessScheduler, inProcessSchedulerEnabled } from '@/lib/scheduler/in-process';
import type { RuntimeAgent } from '@/lib/agents/runtime';

describe('inProcessSchedulerEnabled', () => {
  it('is disabled by default (undefined env) so it never surprises an existing external-ticker deployment', () => {
    expect(inProcessSchedulerEnabled({})).toBe(false);
  });
  it('is enabled by "1" or "true"', () => {
    expect(inProcessSchedulerEnabled({ FOUNDER_OS_INPROCESS_SCHEDULER: '1' })).toBe(true);
    expect(inProcessSchedulerEnabled({ FOUNDER_OS_INPROCESS_SCHEDULER: 'true' })).toBe(true);
  });
  it('is disabled by any other value, never a truthy-string trap like "0" or "false"', () => {
    expect(inProcessSchedulerEnabled({ FOUNDER_OS_INPROCESS_SCHEDULER: '0' })).toBe(false);
    expect(inProcessSchedulerEnabled({ FOUNDER_OS_INPROCESS_SCHEDULER: 'false' })).toBe(false);
    expect(inProcessSchedulerEnabled({ FOUNDER_OS_INPROCESS_SCHEDULER: 'yes' })).toBe(false);
  });
});

describe('startInProcessScheduler', () => {
  let db: FounderDb;
  afterEach(() => {
    db?.close();
    vi.useRealTimers();
  });

  const okAgent: RuntimeAgent = {
    id: 'test-agent',
    name: 'Test Agent',
    description: 'always succeeds',
    departmentId: 'dept-tech',
    async run() {
      return { ok: true, summary: 'ran fine' };
    },
  };

  it('fires a real due cron on its own interval, with no external HTTP caller involved', async () => {
    vi.useFakeTimers();
    // Set the clock to a time such that the FIRST interval fire (60s
    // later) lands exactly on the cron's due minute — the interval fires
    // at t+60s, not at t itself.
    const now = new Date('2026-08-27T08:59:00.000Z');
    vi.setSystemTime(now);

    db = openDb(':memory:');
    db.agentCrons.insert({
      id: 'c1', agentId: 'test-agent', schedule: '0 9 * * *', description: 'x',
      enabled: true, createdAt: '2026-08-01T00:00:00.000Z', lastRunAt: null,
    });

    const onTick = vi.fn();
    const handle = startInProcessScheduler(db, [okAgent], { intervalMs: 60_000, onTick });

    await vi.advanceTimersByTimeAsync(60_000);

    expect(onTick).toHaveBeenCalledTimes(1);
    expect(handle.tickCount).toBe(1);
    expect(handle.lastResult?.fired).toEqual(['c1']);
    expect(db.agentRuns.byAgent('test-agent')).toHaveLength(1);

    handle.stop();
  });

  it('stop() halts further ticks', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T09:00:00.000Z'));
    db = openDb(':memory:');
    const onTick = vi.fn();
    const handle = startInProcessScheduler(db, [okAgent], { intervalMs: 1000, onTick });

    await vi.advanceTimersByTimeAsync(1000);
    expect(onTick).toHaveBeenCalledTimes(1);

    handle.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(onTick).toHaveBeenCalledTimes(1); // no further ticks after stop
  });

  it('a throwing tick is caught and reported via onError, never crashes the interval', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T09:00:00.000Z'));
    db = openDb(':memory:');
    // Force runSchedulerTick to throw by giving it a cron for an unknown
    // agent AND breaking db access — simplest real throw: close the db
    // so agentCrons.allEnabled() itself throws.
    db.close();
    const onError = vi.fn();
    const handle = startInProcessScheduler(db, [okAgent], { intervalMs: 1000, onError });

    await vi.advanceTimersByTimeAsync(1000);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(handle.lastError).not.toBeNull();

    handle.stop();
  });

  it('does not queue a second concurrent tick while one is still in flight', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T09:00:00.000Z'));
    db = openDb(':memory:');
    let concurrentRuns = 0;
    let maxConcurrent = 0;
    const slowAgent: RuntimeAgent = {
      id: 'slow-agent', name: 'Slow', description: 'x', departmentId: 'dept-tech',
      async run() {
        concurrentRuns++;
        maxConcurrent = Math.max(maxConcurrent, concurrentRuns);
        await new Promise((r) => setTimeout(r, 5000));
        concurrentRuns--;
        return { ok: true, summary: 'slow but done' };
      },
    };
    db.agentCrons.insert({
      id: 'c1', agentId: 'slow-agent', schedule: '* * * * *', description: 'x',
      enabled: true, createdAt: '2026-08-01T00:00:00.000Z', lastRunAt: null,
    });
    const handle = startInProcessScheduler(db, [slowAgent], { intervalMs: 1000 });

    // Advance past several interval fires while the first tick is still
    // "running" (its agent takes 5s) — none of those should overlap it.
    await vi.advanceTimersByTimeAsync(4000);
    expect(maxConcurrent).toBeLessThanOrEqual(1);

    await vi.advanceTimersByTimeAsync(2000); // let the slow run finish
    handle.stop();
  });
});
