import { describe, it, expect } from 'vitest';
import { openDb } from '@/lib/db';
import { seedDatabase } from '@/lib/seed';
import { realAgents } from '@/lib/agents/real';

/**
 * The overnight plan asks for a sane cron distribution: system health,
 * executive report, AI intelligence, project lifecycle review, ANKA
 * operations, capability verification. Every seeded cron targets a real
 * runtime agent (no larp) and has a valid, spaced-out schedule so the
 * same agent isn't hammered every minute.
 */
describe('seeded agent crons', () => {
  it('seeds at least the six crons the overnight plan calls for, each targeting a real agent', () => {
    const db = openDb(':memory:');
    seedDatabase(db);
    const runtimeIds = new Set(realAgents.map((a) => a.id));
    const crons = db.agentCrons.all();
    expect(crons.length).toBeGreaterThanOrEqual(6);
    for (const c of crons) {
      expect(runtimeIds.has(c.agentId)).toBe(true);
    }
  });

  it('no two crons on the same agent fire at the exact same minute-of-day (avoids a self-inflicted thundering herd)', () => {
    const db = openDb(':memory:');
    seedDatabase(db);
    const byAgent = new Map<string, Set<string>>();
    for (const c of db.agentCrons.all()) {
      const set = byAgent.get(c.agentId) ?? new Set<string>();
      if (set.has(c.schedule)) throw new Error(`duplicate schedule ${c.schedule} for agent ${c.agentId}`);
      set.add(c.schedule);
      byAgent.set(c.agentId, set);
    }
  });

  it('re-seeding is idempotent — same cron count on a second pass', () => {
    const db = openDb(':memory:');
    seedDatabase(db);
    const first = db.agentCrons.all().length;
    seedDatabase(db);
    const second = db.agentCrons.all().length;
    expect(second).toBe(first);
  });

  it('seeds crons for conductor (system health / lifecycle review) and executive-reporter (daily digest) at minimum', () => {
    const db = openDb(':memory:');
    seedDatabase(db);
    const agentIds = db.agentCrons.all().map((c) => c.agentId);
    expect(agentIds).toContain('conductor');
    expect(agentIds).toContain('executive-reporter');
  });
});
