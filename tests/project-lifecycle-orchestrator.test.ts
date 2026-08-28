import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDb } from '@/lib/db';
import {
  getOrCreateLifecycleState,
  advancePhase,
  recordEvidence,
  projectLifecycleSummary,
} from '@/lib/project-lifecycle-orchestrator';

/**
 * Orchestrator business rules on top of the raw DB repos:
 *  - a project with no lifecycle row yet is lazily created at phase 'idea'
 *  - advancing INTO 'deployment_approval' requires an approval row to exist,
 *    and advancing OUT of it requires that approval to be 'approved'
 *  - advancing appends to history, never rewrites it
 *  - evidence-gated phases (see project-lifecycle-evidence-gate.test.ts for
 *    the dedicated suite) require a passing evidence row to leave
 */
describe('project-lifecycle-orchestrator', () => {
  let db: ReturnType<typeof openDb>;

  beforeEach(() => {
    db = openDb(':memory:');
  });

  afterEach(() => {
    (db as any).close?.();
  });

  it('getOrCreateLifecycleState creates a phase=idea row on first access', () => {
    const state = getOrCreateLifecycleState(db, 'proj-a');
    expect(state.currentPhase).toBe('idea');
    expect(state.history).toHaveLength(1);
    // second call returns the same row, does not duplicate history
    const again = getOrCreateLifecycleState(db, 'proj-a');
    expect(again.history).toHaveLength(1);
  });

  it('advancePhase moves to the next phase and appends history (idea has no evidence requirement)', () => {
    getOrCreateLifecycleState(db, 'proj-b');
    const result = advancePhase(db, 'proj-b', 'conductor');
    expect(result.ok).toBe(true);
    expect(result.state?.currentPhase).toBe('research');
    expect(result.state?.history).toHaveLength(2);
  });

  it('advancePhase refuses to advance past the last phase', () => {
    db.lifecycleState.upsert({
      projectId: 'proj-c',
      currentPhase: 'reporting',
      history: [{ phase: 'reporting', enteredAt: new Date().toISOString() }],
      updatedAt: new Date().toISOString(),
    });
    const result = advancePhase(db, 'proj-c', 'conductor');
    if (result.ok) throw new Error('expected advancePhase to fail');
    expect(result.reason).toMatch(/last phase/i);
  });

  it('advancing FROM launch_readiness INTO deployment_approval auto-creates a pending approval (once its checklist evidence passes)', () => {
    db.lifecycleState.upsert({
      projectId: 'proj-d',
      currentPhase: 'launch_readiness',
      history: [{ phase: 'launch_readiness', enteredAt: new Date().toISOString() }],
      updatedAt: new Date().toISOString(),
    });
    recordEvidence(db, {
      projectId: 'proj-d',
      phase: 'launch_readiness',
      kind: 'launch_checklist',
      ok: true,
      summary: 'checklist complete',
      recordedByAgentId: 'conductor',
    });
    const result = advancePhase(db, 'proj-d', 'conductor');
    expect(result.ok).toBe(true);
    expect(result.state?.currentPhase).toBe('deployment_approval');
    const approvals = db.lifecycleApprovals.byProjectId('proj-d');
    expect(approvals).toHaveLength(1);
    expect(approvals[0].status).toBe('pending');
  });

  it('advancing OUT of deployment_approval is blocked until the approval is approved', () => {
    db.lifecycleState.upsert({
      projectId: 'proj-e',
      currentPhase: 'deployment_approval',
      history: [{ phase: 'deployment_approval', enteredAt: new Date().toISOString() }],
      updatedAt: new Date().toISOString(),
    });
    db.lifecycleApprovals.insert({
      id: 'appr-e',
      projectId: 'proj-e',
      phase: 'deployment_approval',
      title: 'Ship it',
      description: '',
      requestedByAgentId: 'conductor',
      status: 'pending',
      createdAt: new Date().toISOString(),
      decidedAt: null,
      decidedBy: null,
      notes: null,
    });
    const blocked = advancePhase(db, 'proj-e', 'conductor');
    if (blocked.ok) throw new Error('expected advancePhase to be blocked');
    expect(blocked.reason).toMatch(/approval/i);

    db.lifecycleApprovals.decide('appr-e', 'approved', 'local-ui', null);
    const allowed = advancePhase(db, 'proj-e', 'conductor');
    expect(allowed.ok).toBe(true);
    expect(allowed.state?.currentPhase).toBe('growth');
  });

  it('projectLifecycleSummary reports phase, open tasks and pending approvals', () => {
    getOrCreateLifecycleState(db, 'proj-f');
    db.lifecycleTasks.insert({
      id: 'tk1',
      projectId: 'proj-f',
      phase: 'idea',
      title: 'Score the idea',
      responsibleAgentId: 'idea-lab-agent',
      status: 'open',
      blockedReason: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const summary = projectLifecycleSummary(db, 'proj-f');
    expect(summary.currentPhase).toBe('idea');
    expect(summary.openTasks).toHaveLength(1);
    expect(summary.pendingApprovals).toHaveLength(0);
    expect(summary.responsibleAgentId).toBe('idea-lab-agent');
  });
});
