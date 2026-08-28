import { describe, it, expect } from 'vitest';
import { openDb } from '@/lib/db';
import { classifyIntent, delegateTask, startTask, completeTask, failTask, retryTask, INTENT_RULES } from '@/lib/conductor';
import { realAgents } from '@/lib/agents/real';

describe('classifyIntent', () => {
  it('every rule targets an agent id that actually exists in realAgents — no larp routing', () => {
    const runtimeIds = new Set(realAgents.map((a) => a.id));
    for (const rule of INTENT_RULES) {
      expect(runtimeIds.has(rule.agentId)).toBe(true);
    }
  });

  it('routes a QA-shaped goal to qa-ui-review', () => {
    expect(classifyIntent('Run the tests and typecheck before we ship')).toBe('qa-ui-review');
  });
  it('routes a security-shaped goal to security-reviewer', () => {
    expect(classifyIntent('Scan for leaked secrets and vulnerable dependencies')).toBe('security-reviewer');
  });
  it('routes a UI-shaped goal to ui-ux-reviewer', () => {
    expect(classifyIntent('Review the new signup screen for accessibility issues')).toBe('ui-ux-reviewer');
  });
  it('routes a content-shaped goal to social-content-studio', () => {
    expect(classifyIntent('Create a short-form video ad creative for the launch')).toBe('social-content-studio');
  });
  it('routes a research-shaped goal to product-competitor-research', () => {
    expect(classifyIntent('Research our competitor landscape and positioning')).toBe('product-competitor-research');
  });
  it('falls back to conductor itself when nothing matches', () => {
    expect(classifyIntent('asdkjaslkdj random gibberish')).toBe('conductor');
  });
});

describe('delegateTask', () => {
  it('creates a real pending DelegatedTask row', () => {
    const db = openDb(':memory:');
    const task = delegateTask(db, { source: 'user', projectId: 'proj-1', goal: 'Run typecheck and tests' });
    expect(task.assignedAgentId).toBe('qa-ui-review');
    expect(task.status).toBe('pending');
    expect(db.delegatedTasks.byId(task.id)).not.toBeNull();
    db.close();
  });

  it('never creates a duplicate: same project + agent + goal while one is still open', () => {
    const db = openDb(':memory:');
    const t1 = delegateTask(db, { source: 'user', projectId: 'proj-1', goal: 'Run typecheck and tests' });
    const t2 = delegateTask(db, { source: 'user', projectId: 'proj-1', goal: 'Run typecheck and tests' });
    expect(t2.id).toBe(t1.id);
    expect(db.delegatedTasks.all()).toHaveLength(1);
    db.close();
  });

  it('allows a new task once the prior one is terminal', () => {
    const db = openDb(':memory:');
    const t1 = delegateTask(db, { source: 'user', projectId: 'proj-1', goal: 'Run typecheck and tests' });
    completeTask(db, t1.id, 'all green');
    const t2 = delegateTask(db, { source: 'user', projectId: 'proj-1', goal: 'Run typecheck and tests' });
    expect(t2.id).not.toBe(t1.id);
    expect(db.delegatedTasks.all()).toHaveLength(2);
    db.close();
  });

  it('honors an explicit assignedAgentId override instead of classifying', () => {
    const db = openDb(':memory:');
    const task = delegateTask(db, { source: 'user', projectId: null, assignedAgentId: 'work-assistant', goal: 'follow up with Jane' });
    expect(task.assignedAgentId).toBe('work-assistant');
    db.close();
  });

  it('a task with unmet dependencies starts blocked, not pending', () => {
    const db = openDb(':memory:');
    const dep = delegateTask(db, { source: 'user', projectId: 'proj-1', goal: 'Run typecheck and tests' });
    const task = delegateTask(db, { source: 'user', projectId: 'proj-1', goal: 'Deploy readiness check', dependencies: [dep.id] });
    expect(task.status).toBe('blocked');
    db.close();
  });
});

describe('startTask / completeTask / failTask', () => {
  it('startTask moves pending -> in_progress with a startedAt timestamp', () => {
    const db = openDb(':memory:');
    const t = delegateTask(db, { source: 'user', projectId: null, goal: 'Run typecheck and tests' });
    startTask(db, t.id);
    const updated = db.delegatedTasks.byId(t.id)!;
    expect(updated.status).toBe('in_progress');
    expect(updated.startedAt).not.toBeNull();
    db.close();
  });

  it('completeTask moves to done with a resultSummary and finishedAt, and unblocks a dependent', () => {
    const db = openDb(':memory:');
    const dep = delegateTask(db, { source: 'user', projectId: 'proj-1', goal: 'Run typecheck and tests' });
    const task = delegateTask(db, { source: 'user', projectId: 'proj-1', goal: 'Deploy readiness check', dependencies: [dep.id] });
    expect(db.delegatedTasks.byId(task.id)!.status).toBe('blocked');
    completeTask(db, dep.id, 'all green');
    const unblocked = db.delegatedTasks.byId(task.id)!;
    expect(unblocked.status).toBe('pending');
    db.close();
  });

  it('failTask records a failureReason and moves to failed', () => {
    const db = openDb(':memory:');
    const t = delegateTask(db, { source: 'user', projectId: null, goal: 'Run typecheck and tests' });
    failTask(db, t.id, 'build ENOENT');
    const updated = db.delegatedTasks.byId(t.id)!;
    expect(updated.status).toBe('failed');
    expect(updated.failureReason).toBe('build ENOENT');
    db.close();
  });
});

describe('retryTask', () => {
  it('creates a fresh pending task cloned from a failed one, same agent by default', () => {
    const db = openDb(':memory:');
    const t = delegateTask(db, { source: 'user', projectId: 'proj-1', goal: 'Run typecheck and tests' });
    failTask(db, t.id, 'ENOENT');
    const retried = retryTask(db, t.id);
    expect(retried.id).not.toBe(t.id);
    expect(retried.status).toBe('pending');
    expect(retried.assignedAgentId).toBe(t.assignedAgentId);
    expect(retried.goal).toBe(t.goal);
    db.close();
  });

  it('can reassign to a different agent on retry', () => {
    const db = openDb(':memory:');
    const t = delegateTask(db, { source: 'user', projectId: 'proj-1', goal: 'Run typecheck and tests' });
    failTask(db, t.id, 'ENOENT');
    const retried = retryTask(db, t.id, { reassignTo: 'claude-code-orchestrator' });
    expect(retried.assignedAgentId).toBe('claude-code-orchestrator');
    db.close();
  });

  it('refuses to retry a task that is not in a terminal state', () => {
    const db = openDb(':memory:');
    const t = delegateTask(db, { source: 'user', projectId: 'proj-1', goal: 'Run typecheck and tests' });
    expect(() => retryTask(db, t.id)).toThrow();
    db.close();
  });
});
