import { describe, expect, test, afterEach } from 'vitest';
import { openDb, type FounderDb } from '@/lib/db';
import { runSchedulerTick } from '@/lib/scheduler/tick';
import type { RuntimeAgent } from '@/lib/agents/runtime';

/**
 * Scheduler final check (V1 completion sprint item 8): verify the
 * scheduler cannot duplicate-run, runaway-loop, or spam under conditions
 * a single-tick sequential test wouldn't reveal — specifically two
 * genuinely CONCURRENT ticks for the same due minute (an external ticker
 * double-firing, or overlapping if a previous tick is still mid-flight
 * when the next one starts). This is the same class of race D-156 in a
 * sibling project's Phase 8 solved with a claim/lease.
 */
let db: FounderDb;
afterEach(() => {
  db?.close();
});

describe('runSchedulerTick — concurrent-tick safety', () => {
  test('two truly concurrent ticks for the same due minute do not both fire the same cron', async () => {
    db = openDb(':memory:');
    let runCount = 0;
    const slowAgent: RuntimeAgent = {
      id: 'slow-agent',
      name: 'Slow Agent',
      description: 'simulates a slow-running agent',
      departmentId: 'dept-tech',
      async run() {
        runCount++;
        // Yield so both concurrent ticks' for-loops can interleave before
        // either writes lastRunAt — the real race condition shape.
        await new Promise((r) => setTimeout(r, 20));
        return { ok: true, summary: 'ran' };
      },
    };
    db.agentCrons.insert({
      id: 'c1', agentId: 'slow-agent', schedule: '0 9 * * *', description: 'x',
      enabled: true, createdAt: '2026-08-01T00:00:00.000Z', lastRunAt: null,
    });
    const now = new Date('2026-08-27T09:00:00.000Z');
    // Fire two ticks concurrently, not sequentially.
    const [r1, r2] = await Promise.all([
      runSchedulerTick(db, [slowAgent], now),
      runSchedulerTick(db, [slowAgent], now),
    ]);
    const totalFired = r1.fired.length + r2.fired.length;
    expect(totalFired).toBe(1);
    expect(runCount).toBe(1);
    expect(db.agentRuns.byAgent('slow-agent')).toHaveLength(1);
  });
});
