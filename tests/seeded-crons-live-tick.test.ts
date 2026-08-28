import { describe, it, expect } from 'vitest';
import { openDb } from '@/lib/db';
import { seedDatabase } from '@/lib/seed';
import { realAgents } from '@/lib/agents/real';
import { runSchedulerTick } from '@/lib/scheduler/tick';

/**
 * End-to-end proof that the seeded cron distribution (see seed.ts's
 * agentCrons) is actually runnable by runSchedulerTick against the real
 * runtime agent roster — not just internally consistent ids, but a real
 * tick that would actually fire each one at its scheduled time.
 */
describe('seeded crons run for real through runSchedulerTick', () => {
  it('every seeded cron fires (no "unknown agent" skips) when now matches its schedule', async () => {
    const db = openDb(':memory:');
    seedDatabase(db);

    const crons = db.agentCrons.all();
    expect(crons.length).toBeGreaterThan(0);

    for (const cron of crons) {
      // Reset lastRunAt so this cron is eligible to fire again, then find a
      // `now` that matches its own schedule (all seeded schedules are
      // either */N or a fixed hour, both of which match at their own hour).
      db.agentCrons.insert({ ...cron, lastRunAt: null });
      const now = scheduleMatchTime(cron.schedule);
      const result = await runSchedulerTick(db, realAgents, now);
      const skip = result.skipped.find((s) => s.cronId === cron.id);
      expect(skip, `cron ${cron.id} (agent ${cron.agentId}) was skipped: ${skip?.reason}`).toBeUndefined();
    }
  });
});

/** Builds a Date that satisfies a subset of cron syntax actually used in
 *  seed.ts: '*\/N * * * *', '0 H * * *', '0 *\/N * * *'. Not a general
 *  cron-to-date solver — just enough to exercise every seeded schedule. */
function scheduleMatchTime(schedule: string): Date {
  const [min, hour] = schedule.split(' ');
  const d = new Date('2026-08-28T00:00:00.000Z');
  if (hour !== '*' && !hour.startsWith('*/')) {
    d.setUTCHours(Number(hour));
  } else if (hour.startsWith('*/')) {
    d.setUTCHours(Number(hour.slice(2))); // e.g. */6 matches hour 6
  }
  if (min !== '*' && !min.startsWith('*/')) {
    d.setUTCMinutes(Number(min));
  } else if (min.startsWith('*/')) {
    d.setUTCMinutes(Number(min.slice(2))); // e.g. */30 matches minute 30
  } else {
    d.setUTCMinutes(0);
  }
  return d;
}
