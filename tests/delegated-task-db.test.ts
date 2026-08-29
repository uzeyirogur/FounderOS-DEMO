import { describe, it, expect } from 'vitest';
import { openDb } from '@/lib/db';

describe('db.delegatedTasks', () => {
  it('inserts and reads back a full task', () => {
    const db = openDb(':memory:');
    db.delegatedTasks.insert({
      id: 't1', source: 'user', projectId: 'proj-1', assignedAgentId: 'qa-ui-review',
      goal: 'Run typecheck', status: 'pending', priority: 'high', dependencies: [],
      approvalRequirement: 'none', createdAt: new Date().toISOString(), startedAt: null,
      finishedAt: null, resultSummary: null, failureReason: null, retryCount: 0,
    });
    const all = db.delegatedTasks.all();
    expect(all).toHaveLength(1);
    expect(all[0].goal).toBe('Run typecheck');
    expect(all[0].priority).toBe('high');
    db.close();
  });

  it('byId resolves a single task', () => {
    const db = openDb(':memory:');
    db.delegatedTasks.insert({
      id: 't1', source: 'conductor', projectId: null, assignedAgentId: 'work-assistant',
      goal: 'x', status: 'pending', priority: 'normal', dependencies: [],
      approvalRequirement: 'none', createdAt: new Date().toISOString(), startedAt: null,
      finishedAt: null, resultSummary: null, failureReason: null, retryCount: 0,
    });
    expect(db.delegatedTasks.byId('t1')?.assignedAgentId).toBe('work-assistant');
    expect(db.delegatedTasks.byId('nope')).toBeNull();
    db.close();
  });

  it('byProjectId filters to one project; null-project tasks excluded', () => {
    const db = openDb(':memory:');
    db.delegatedTasks.insert({
      id: 't1', source: 'user', projectId: 'proj-1', assignedAgentId: 'a',
      goal: 'x', status: 'pending', priority: 'normal', dependencies: [],
      approvalRequirement: 'none', createdAt: new Date().toISOString(), startedAt: null,
      finishedAt: null, resultSummary: null, failureReason: null, retryCount: 0,
    });
    db.delegatedTasks.insert({
      id: 't2', source: 'user', projectId: null, assignedAgentId: 'a',
      goal: 'y', status: 'pending', priority: 'normal', dependencies: [],
      approvalRequirement: 'none', createdAt: new Date().toISOString(), startedAt: null,
      finishedAt: null, resultSummary: null, failureReason: null, retryCount: 0,
    });
    expect(db.delegatedTasks.byProjectId('proj-1').map((t) => t.id)).toEqual(['t1']);
    db.close();
  });

  it('updateStatus persists status + timestamps + result/failure fields', () => {
    const db = openDb(':memory:');
    db.delegatedTasks.insert({
      id: 't1', source: 'user', projectId: null, assignedAgentId: 'a',
      goal: 'x', status: 'pending', priority: 'normal', dependencies: [],
      approvalRequirement: 'none', createdAt: new Date().toISOString(), startedAt: null,
      finishedAt: null, resultSummary: null, failureReason: null, retryCount: 0,
    });
    db.delegatedTasks.updateStatus('t1', { status: 'done', finishedAt: '2026-01-01T00:00:00.000Z', resultSummary: 'ok' });
    const task = db.delegatedTasks.byId('t1')!;
    expect(task.status).toBe('done');
    expect(task.finishedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(task.resultSummary).toBe('ok');
    db.close();
  });

  it('pending() lists only non-terminal tasks, across all projects', () => {
    const db = openDb(':memory:');
    db.delegatedTasks.insert({
      id: 't1', source: 'user', projectId: null, assignedAgentId: 'a',
      goal: 'x', status: 'pending', priority: 'normal', dependencies: [],
      approvalRequirement: 'none', createdAt: new Date().toISOString(), startedAt: null,
      finishedAt: null, resultSummary: null, failureReason: null, retryCount: 0,
    });
    db.delegatedTasks.insert({
      id: 't2', source: 'user', projectId: null, assignedAgentId: 'a',
      goal: 'y', status: 'done', priority: 'normal', dependencies: [],
      approvalRequirement: 'none', createdAt: new Date().toISOString(), startedAt: null,
      finishedAt: null, resultSummary: null, failureReason: null, retryCount: 0,
    });
    expect(db.delegatedTasks.pending().map((t) => t.id)).toEqual(['t1']);
    db.close();
  });
});
