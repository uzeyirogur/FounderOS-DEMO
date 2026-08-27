/**
 * Cron schedule helpers for agent jobs. Definitions are stored in SQLite and
 * displayed here; the actual runner lands with the dedicated host deployment — the
 * OS is honest about that in the UI.
 */
const FIELD_RE = /^(\*|[0-9*/,-]+)$/;

export function isValidCron(expr: string): boolean {
  const fields = expr.trim().split(/\s+/);
  return fields.length === 5 && fields.every((f) => FIELD_RE.test(f) && !/[a-z]/i.test(f));
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dowLabel(field: string): string | null {
  if (field === '*') return 'daily';
  const range = field.match(/^(\d)-(\d)$/);
  if (range) {
    const [a, b] = [Number(range[1]), Number(range[2])];
    if (a <= 6 && b <= 6) return `${DOW[a]}–${DOW[b]}`;
  }
  if (/^\d$/.test(field) && Number(field) <= 6) return DOW[Number(field)];
  return field; // comma lists etc. shown raw
}

/** Does one cron field (minute/hour/dom/month/dow) match a given numeric value?
 *  Supports: '*', a plain number, 'a-b' ranges, comma lists, and '*\/N' steps.
 *  Comma lists may mix any of the above (each segment evaluated independently). */
function fieldMatches(field: string, value: number): boolean {
  return field.split(',').some((segment) => {
    if (segment === '*') return true;
    const step = segment.match(/^\*\/(\d+)$/);
    if (step) return value % Number(step[1]) === 0;
    const range = segment.match(/^(\d+)-(\d+)$/);
    if (range) return value >= Number(range[1]) && value <= Number(range[2]);
    return /^\d+$/.test(segment) && Number(segment) === value;
  });
}

/**
 * Whether a 5-field cron expression is due to fire at `now`, given the cron's
 * `lastRunAt` (ISO string or null). All comparisons are UTC minute-resolution:
 * the scheduler ticks roughly once a minute, so this only needs to answer
 * "does this minute match, and have we not already fired for it".
 */
export function isDue(expr: string, now: Date, lastRunAt: string | null): boolean {
  if (!isValidCron(expr)) return false;
  const [minField, hourField, domField, monthField, dowField] = expr.trim().split(/\s+/);
  if (!fieldMatches(minField, now.getUTCMinutes())) return false;
  if (!fieldMatches(hourField, now.getUTCHours())) return false;
  if (!fieldMatches(domField, now.getUTCDate())) return false;
  if (!fieldMatches(monthField, now.getUTCMonth() + 1)) return false;
  if (!fieldMatches(dowField, now.getUTCDay())) return false;

  if (lastRunAt) {
    const last = new Date(lastRunAt);
    // Same UTC minute as the last run -> already fired for this minute.
    if (
      last.getUTCFullYear() === now.getUTCFullYear() &&
      last.getUTCMonth() === now.getUTCMonth() &&
      last.getUTCDate() === now.getUTCDate() &&
      last.getUTCHours() === now.getUTCHours() &&
      last.getUTCMinutes() === now.getUTCMinutes()
    ) {
      return false;
    }
  }
  return true;
}

/** Human-readable summary, or null if the expression is not 5 valid fields. */
export function describeCron(expr: string): string | null {
  if (!isValidCron(expr)) return null;
  const [min, hour, , , dow] = expr.trim().split(/\s+/);

  const every = min.match(/^\*\/(\d+)$/);
  if (every && hour === '*') return `every ${every[1]} min`;

  if (/^\d+$/.test(min) && hour === '*') return `hourly at :${min.padStart(2, '0')}`;

  if (/^\d+$/.test(min) && /^\d+$/.test(hour)) {
    const time = `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
    return `at ${time}, ${dowLabel(dow)}`;
  }

  return `cron ${expr}`;
}
