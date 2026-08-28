import { describe, it, expect } from 'vitest';
import {
  DelegatedTaskSchema,
  DelegatedTaskStatusSchema,
  DelegatedTaskPrioritySchema,
} from '@/lib/schemas';

/**
 * Conductor v2's task/work-item domain: every delegation the Chief of Staff
 * makes is a real, persisted, inspectable row — not an in-memory decision
 * that vanishes after one chat turn.
 */
describe('DelegatedTaskSchema', () => {
  it('accepts a full task with every field the Conductor plan calls for', () => {
    const task = {
      id: 't1',
      source: 'user',
      projectId: 'proj-1',
      assignedAgentId: 'qa-ui-review',
      goal: 'Run typecheck and tests before merging',
      status: 'pending',
      priority: 'normal',
      dependencies: [],
      approvalRequirement: 'none',
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      resultSummary: null,
      failureReason: null,
    };
    expect(DelegatedTaskSchema.parse(task)).toMatchObject(task);
  });

  it('defaults status to pending and dependencies to empty', () => {
    const task = DelegatedTaskSchema.parse({
      id: 't2',
      source: 'conductor',
      projectId: null,
      assignedAgentId: 'work-assistant',
      goal: 'x',
      createdAt: new Date().toISOString(),
    });
    expect(task.status).toBe('pending');
    expect(task.dependencies).toEqual([]);
    expect(task.priority).toBe('normal');
    expect(task.approvalRequirement).toBe('none');
  });

  it('every real status is a valid enum member', () => {
    for (const s of ['pending', 'in_progress', 'blocked', 'awaiting_approval', 'done', 'failed', 'cancelled']) {
      expect(DelegatedTaskStatusSchema.parse(s)).toBe(s);
    }
  });

  it('every real priority is a valid enum member', () => {
    for (const p of ['low', 'normal', 'high', 'urgent']) {
      expect(DelegatedTaskPrioritySchema.parse(p)).toBe(p);
    }
  });

  it('rejects an unknown status', () => {
    expect(() => DelegatedTaskStatusSchema.parse('nope')).toThrow();
  });
});
