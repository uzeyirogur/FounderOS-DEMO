import { describe, it, expect } from 'vitest';
import { PersonalTaskSchema, PersonalTaskPrioritySchema, PersonalTaskStatusSchema } from '@/lib/schemas';

/**
 * Work Assistant's own task list — deliberately separate from the
 * Project Registry / agentTasks (agent work items) and from Personal
 * Ops' routines. This is "things Alex needs to personally do", with an
 * optional due date and priority, independent of any project lifecycle.
 */
describe('PersonalTaskSchema', () => {
  it('accepts a minimal task', () => {
    const t = PersonalTaskSchema.parse({
      id: 't1', title: 'Call the accountant', dueAt: null, priority: 'normal', status: 'open',
      createdAt: new Date().toISOString(), completedAt: null,
    });
    expect(t.status).toBe('open');
  });

  it('enumerates exactly three priorities', () => {
    expect(PersonalTaskPrioritySchema.options).toEqual(['low', 'normal', 'high']);
  });

  it('enumerates exactly two statuses', () => {
    expect(PersonalTaskStatusSchema.options).toEqual(['open', 'done']);
  });

  it('rejects an empty title', () => {
    expect(() =>
      PersonalTaskSchema.parse({ id: 't1', title: '', dueAt: null, priority: 'normal', status: 'open', createdAt: new Date().toISOString(), completedAt: null }),
    ).toThrow();
  });
});
