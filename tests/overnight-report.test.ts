import { describe, it, expect } from 'vitest';
import { openDb } from '@/lib/db';
import { buildOvernightReport } from '@/lib/agents/overnight-report';

/**
 * Executive Reporter's real "overnight report" — everything the plan asks
 * for (completed phases via delegated tasks, pending approvals, pending
 * credentials/capabilities, lifecycle states, agent run health) pulled
 * from real DB rows. No LLM, no invented commentary — every field traces
 * to a real query.
 */
describe('buildOvernightReport', () => {
  it('reports zero everything on an empty database, never fabricates activity', () => {
    const db = openDb(':memory:');
    const report = buildOvernightReport(db);
    expect(report.completedTasks).toHaveLength(0);
    expect(report.failedTasks).toHaveLength(0);
    expect(report.pendingApprovals).toHaveLength(0);
    expect(report.candidateCapabilities).toHaveLength(0);
    expect(report.projectLifecycleStates).toHaveLength(0);
  });

  it('surfaces completed and failed delegated tasks separately', () => {
    const db = openDb(':memory:');
    db.delegatedTasks.insert({
      id: 't1', source: 'user', projectId: 'proj-1', assignedAgentId: 'qa-ui-review', goal: 'run tests',
      status: 'done', priority: 'normal', dependencies: [], approvalRequirement: 'none',
      createdAt: new Date().toISOString(), startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(),
      resultSummary: 'all green', failureReason: null,
    });
    db.delegatedTasks.insert({
      id: 't2', source: 'user', projectId: 'proj-1', assignedAgentId: 'security-reviewer', goal: 'scan',
      status: 'failed', priority: 'normal', dependencies: [], approvalRequirement: 'none',
      createdAt: new Date().toISOString(), startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(),
      resultSummary: null, failureReason: 'npm audit unreachable',
    });
    const report = buildOvernightReport(db);
    expect(report.completedTasks).toHaveLength(1);
    expect(report.failedTasks).toHaveLength(1);
    expect(report.failedTasks[0].failureReason).toBe('npm audit unreachable');
  });

  it('surfaces pending lifecycle approvals and candidate capabilities', () => {
    const db = openDb(':memory:');
    db.lifecycleApprovals.insert({
      id: 'a1', projectId: 'proj-1', phase: 'deployment_approval', title: 'Ship it', description: '',
      requestedByAgentId: 'conductor', status: 'pending', createdAt: new Date().toISOString(),
      decidedAt: null, decidedBy: null, notes: null,
    });
    db.capabilities.insert({
      id: 'c1', name: 'Some Tool', capability: 'video-generation', type: 'api', connector: null,
      authRequired: true, costModel: 'paid', freeTier: null, status: 'candidate', installed: false,
      configured: false, approvedByUser: false, allowedAgents: [], notes: null, lastVerifiedAt: null,
    });
    const report = buildOvernightReport(db);
    expect(report.pendingApprovals).toHaveLength(1);
    expect(report.candidateCapabilities).toHaveLength(1);
  });

  it('summarizes project lifecycle states across every registered project', () => {
    const db = openDb(':memory:');
    db.lifecycleState.upsert({
      projectId: 'proj-1', currentPhase: 'qa', history: [{ phase: 'idea', enteredAt: new Date().toISOString() }],
      updatedAt: new Date().toISOString(),
    });
    const report = buildOvernightReport(db);
    expect(report.projectLifecycleStates).toEqual([{ projectId: 'proj-1', currentPhase: 'qa' }]);
  });

  it('toMarkdown() renders a real, readable digest with every section, honest about emptiness', () => {
    const db = openDb(':memory:');
    const report = buildOvernightReport(db);
    const md = report.toMarkdown();
    expect(md).toContain('Completed');
    expect(md).toContain('Pending approvals');
    expect(md).toContain('none');
  });
});
