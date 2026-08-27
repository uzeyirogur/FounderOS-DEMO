import { describe, expect, test } from 'vitest';
import { isDue } from '@/lib/cron';

/**
 * isDue evaluates a 5-field cron expression against a point in time, honoring
 * lastRunAt so a tick that runs more than once inside the same matching
 * minute does not fire twice. All times are UTC (the scheduler runs on the
 * server, not in the operator's browser timezone) — pass `now` and
 * `lastRunAt` as ISO strings.
 */
describe('isDue', () => {
  test('fires when every field matches the given minute', () => {
    // 0 9 * * * -> 09:00 any day
    expect(isDue('0 9 * * *', new Date('2026-08-27T09:00:00.000Z'), null)).toBe(true);
  });

  test('does not fire when the minute does not match', () => {
    expect(isDue('0 9 * * *', new Date('2026-08-27T09:01:00.000Z'), null)).toBe(false);
  });

  test('does not fire when the hour does not match', () => {
    expect(isDue('0 9 * * *', new Date('2026-08-27T10:00:00.000Z'), null)).toBe(false);
  });

  test('every-N-minutes field (*/15) fires only on multiples', () => {
    expect(isDue('*/15 * * * *', new Date('2026-08-27T09:15:00.000Z'), null)).toBe(true);
    expect(isDue('*/15 * * * *', new Date('2026-08-27T09:16:00.000Z'), null)).toBe(false);
    expect(isDue('*/15 * * * *', new Date('2026-08-27T09:00:00.000Z'), null)).toBe(true);
  });

  test('day-of-week field restricts to matching weekdays (0=Sun..6=Sat)', () => {
    // 2026-08-27 is a Thursday (4)
    expect(isDue('0 9 * * 4', new Date('2026-08-27T09:00:00.000Z'), null)).toBe(true);
    expect(isDue('0 9 * * 1', new Date('2026-08-27T09:00:00.000Z'), null)).toBe(false);
  });

  test('a weekday range (1-5) matches Mon..Fri only', () => {
    expect(isDue('0 9 * * 1-5', new Date('2026-08-27T09:00:00.000Z'), null)).toBe(true); // Thu
    expect(isDue('0 9 * * 1-5', new Date('2026-08-30T09:00:00.000Z'), null)).toBe(false); // Sun
  });

  test('a comma list matches any listed value', () => {
    expect(isDue('0 9,18 * * *', new Date('2026-08-27T18:00:00.000Z'), null)).toBe(true);
    expect(isDue('0 9,18 * * *', new Date('2026-08-27T12:00:00.000Z'), null)).toBe(false);
  });

  test('does not re-fire twice inside the same matching minute', () => {
    const now = new Date('2026-08-27T09:00:30.000Z');
    const lastRunAt = '2026-08-27T09:00:05.000Z'; // already ran this same minute
    expect(isDue('0 9 * * *', now, lastRunAt)).toBe(false);
  });

  test('fires again once the clock moves to a new matching minute', () => {
    const now = new Date('2026-08-27T09:00:05.000Z');
    const lastRunAt = '2026-08-26T09:00:05.000Z'; // yesterday's run
    expect(isDue('0 9 * * *', now, lastRunAt)).toBe(true);
  });

  test('an invalid cron expression is never due', () => {
    expect(isDue('not a cron', new Date(), null)).toBe(false);
    expect(isDue('0 9 * *', new Date(), null)).toBe(false); // only 4 fields
  });
});
