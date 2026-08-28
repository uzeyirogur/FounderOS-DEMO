import { describe, it, expect } from 'vitest';
import { RoutineSchema, RoutineFrequencySchema, RoutineCompletionSchema } from '@/lib/schemas';

/**
 * Personal Ops' domain: recurring routines/habits, NOT one-off tasks
 * (that's Work Assistant) and NOT a Project Registry project. A routine
 * has a frequency; completions are a separate append-only log so streak
 * history survives even if the routine itself changes.
 */
describe('RoutineSchema', () => {
  it('accepts a daily routine', () => {
    const r = RoutineSchema.parse({
      id: 'r1', title: 'Morning walk', frequency: 'daily', active: true, createdAt: new Date().toISOString(),
    });
    expect(r.frequency).toBe('daily');
    expect(r.active).toBe(true);
  });

  it('enumerates exactly four frequencies', () => {
    expect(RoutineFrequencySchema.options).toEqual(['daily', 'weekdays', 'weekly', 'monthly']);
  });

  it('rejects an empty title', () => {
    expect(() =>
      RoutineSchema.parse({ id: 'r1', title: '', frequency: 'daily', active: true, createdAt: new Date().toISOString() }),
    ).toThrow();
  });
});

describe('RoutineCompletionSchema', () => {
  it('is an append-only log entry tying a routine to a date', () => {
    const c = RoutineCompletionSchema.parse({ id: 'c1', routineId: 'r1', completedOn: '2026-08-28', completedAt: new Date().toISOString() });
    expect(c.routineId).toBe('r1');
  });
});
