/**
 * Personal Ops' streak logic — pure, no DB dependency so the rule itself
 * is directly testable. A streak counts consecutive calendar days ending
 * TODAY or, if today has not been checked in yet, ending YESTERDAY (so a
 * user checking in later in the day doesn't see their streak flash to 0
 * for the few hours before they log it).
 */

function dayBefore(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function currentStreak(completedOnDates: string[], today: string): number {
  const days = new Set(completedOnDates);
  if (days.size === 0) return 0;

  let cursor = days.has(today) ? today : dayBefore(today);
  if (!days.has(cursor)) return 0;

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = dayBefore(cursor);
  }
  return streak;
}
