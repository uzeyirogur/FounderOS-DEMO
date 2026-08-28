import { describe, it, expect } from 'vitest';
import { currentStreak } from '@/lib/personal-ops';

/** currentStreak(completedOnDates, today) — consecutive days ending
 *  today (or yesterday, since today may not be checked in yet). Pure
 *  function, no DB, so the streak rule itself is directly testable. */
describe('currentStreak', () => {
  it('is 0 with no completions', () => {
    expect(currentStreak([], '2026-08-28')).toBe(0);
  });

  it('is 1 when only today is checked in', () => {
    expect(currentStreak(['2026-08-28'], '2026-08-28')).toBe(1);
  });

  it('counts consecutive days ending today', () => {
    expect(currentStreak(['2026-08-26', '2026-08-27', '2026-08-28'], '2026-08-28')).toBe(3);
  });

  it('still counts a streak ending yesterday (today not checked in yet)', () => {
    expect(currentStreak(['2026-08-26', '2026-08-27'], '2026-08-28')).toBe(2);
  });

  it('breaks the streak at a gap', () => {
    expect(currentStreak(['2026-08-20', '2026-08-27', '2026-08-28'], '2026-08-28')).toBe(2);
  });

  it('is 0 when the most recent completion is more than a day stale', () => {
    expect(currentStreak(['2026-08-20'], '2026-08-28')).toBe(0);
  });

  it('ignores order and duplicates in the input', () => {
    expect(currentStreak(['2026-08-28', '2026-08-27', '2026-08-27', '2026-08-26'], '2026-08-28')).toBe(3);
  });
});
