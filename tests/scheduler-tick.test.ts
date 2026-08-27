import { describe, expect, test, afterEach, vi } from 'vitest';
import { openDb, type FounderDb } from '@/lib/db';
import { runSchedulerTick } from '@/lib/scheduler/tick';
import type { RuntimeAgent } from '@/lib/agents/runtime';

/**
 * The scheduler tick: reads every enabled cron, fires the ones isDue() says
 * are due against `now`, actually runs the target agent through the same
 * runtime.run() path a manual /api/agents/[id]/run click uses (one run
 * history, one code path), and stamps lastRunAt so the same minute never
 * double-fires. This is the piece the plan calls "runner process" — today it
 * is invoked by an external ticker (Hermes cron hitting /api/scheduler/tick);
 * tomorrow the same function is called by an in-process interval on the
 * dedicated host. Nothing about runSchedulerTick's signature changes either way.
 */
let db: FounderDb;

afterEach(() => {
  db?.close();
  vi.restoreAllMocks();
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

describe('runSchedulerTick', () => {
  test('fires a due, enabled cron and records the run', async () => {
    db = openDb(':memory:');
    db.agentCrons.insert({
      id: 'c1',
      agentId: 'test-agent',
      schedule: '0 9 * * *',
      description: 'daily check',
      enabled: true,
      createdAt: '2026-08-01T00:00:00.000Z',
      lastRunAt: null,
    });
    const now = new Date('2026-08-27T09:00:00.000Z');
    const result = await runSchedulerTick(db, [okAgent], now);
    expect(result.fired).toEqual(['c1']);
    expect(result.skipped).toEqual([]);
    const runs = db.agentRuns.byAgent('test-agent');
    expect(runs).toHaveLength(1);
    expect(runs[0].ok).toBe(true);
    expect(db.agentCrons.byAgent('test-agent')[0].lastRunAt).toBe(now.toISOString());
  });

  test('does not fire a disabled cron', async () => {
    db = openDb(':memory:');
    db.agentCrons.insert({
      id: 'c1', agentId: 'test-agent', schedule: '0 9 * * *', description: 'x',
      enabled: false, createdAt: '2026-08-01T00:00:00.000Z', lastRunAt: null,
    });
    const result = await runSchedulerTick(db, [okAgent], new Date('2026-08-27T09:00:00.000Z'));
    expect(result.fired).toEqual([]);
    expect(db.agentRuns.byAgent('test-agent')).toHaveLength(0);
  });

  test('does not fire when the schedule does not match now', async () => {
    db = openDb(':memory:');
    db.agentCrons.insert({
      id: 'c1', agentId: 'test-agent', schedule: '0 9 * * *', description: 'x',
      enabled: true, createdAt: '2026-08-01T00:00:00.000Z', lastRunAt: null,
    });
    const result = await runSchedulerTick(db, [okAgent], new Date('2026-08-27T10:00:00.000Z'));
    expect(result.fired).toEqual([]);
    expect(db.agentRuns.byAgent('test-agent')).toHaveLength(0);
  });

  test('does not double-fire the same minute across two ticks', async () => {
    db = openDb(':memory:');
    db.agentCrons.insert({
      id: 'c1', agentId: 'test-agent', schedule: '0 9 * * *', description: 'x',
      enabled: true, createdAt: '2026-08-01T00:00:00.000Z', lastRunAt: null,
    });
    const now = new Date('2026-08-27T09:00:00.000Z');
    await runSchedulerTick(db, [okAgent], now);
    const second = await runSchedulerTick(db, [okAgent], new Date('2026-08-27T09:00:30.000Z'));
    expect(second.fired).toEqual([]);
    expect(db.agentRuns.byAgent('test-agent')).toHaveLength(1);
  });

  test('reports an unknown agent id as skipped rather than throwing', async () => {
    db = openDb(':memory:');
    db.agentCrons.insert({
      id: 'c1', agentId: 'ghost-agent', schedule: '0 9 * * *', description: 'x',
      enabled: true, createdAt: '2026-08-01T00:00:00.000Z', lastRunAt: null,
    });
    const result = await runSchedulerTick(db, [okAgent], new Date('2026-08-27T09:00:00.000Z'));
    expect(result.fired).toEqual([]);
    expect(result.skipped).toEqual([{ cronId: 'c1', reason: 'unknown agent: ghost-agent' }]);
  });

  test('one cron failing does not block another due cron from firing', async () => {
    db = openDb(':memory:');
    const failAgent: RuntimeAgent = {
      id: 'fail-agent', name: 'Fail', description: 'x', departmentId: 'dept-tech',
      async run(): Promise<never> { throw new Error('boom'); },
    };
    db.agentCrons.insert({ id: 'c1', agentId: 'fail-agent', schedule: '0 9 * * *', description: 'x', enabled: true, createdAt: '2026-08-01T00:00:00.000Z', lastRunAt: null });
    db.agentCrons.insert({ id: 'c2', agentId: 'test-agent', schedule: '0 9 * * *', description: 'x', enabled: true, createdAt: '2026-08-01T00:00:00.000Z', lastRunAt: null });
    const result = await runSchedulerTick(db, [okAgent, failAgent], new Date('2026-08-27T09:00:00.000Z'));
    expect(result.fired.sort()).toEqual(['c1', 'c2']);
    // the failing agent's run is recorded as ok:false, not thrown
    expect(db.agentRuns.byAgent('fail-agent')[0].ok).toBe(false);
    expect(db.agentRuns.byAgent('test-agent')[0].ok).toBe(true);
  });
});
