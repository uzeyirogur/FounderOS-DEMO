import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDb } from '@/lib/db';

/** DB-layer tests for the Project Lifecycle Orchestrator's three tables.
 *  Repo convention: openDb(':memory:') + db.close() in afterEach — NOT
 *  file + fs.rmSync, which reliably triggers Windows EBUSY in this repo. */
describe('lifecycleState / lifecycleTasks / lifecycleApprovals repos', () => {
  let db: ReturnType<typeof openDb>;

  beforeEach(() => {
    db = openDb(':memory:');
  });

  afterEach(() => {
    (db as any).close?.();
  });

  it('lifecycleState upserts and reads back a project phase', () => {
    const now = new Date().toISOString();
    db.lifecycleState.upsert({
      projectId: 'demo-project',
      currentPhase: 'idea',
      history: [{ phase: 'idea', enteredAt: now }],
      updatedAt: now,
    });
    const row = db.lifecycleState.byProjectId('demo-project');
    expect(row?.currentPhase).toBe('idea');
    expect(row?.history).toHaveLength(1);
  });

  it('lifecycleState.byProjectId returns null for an unknown project', () => {
    expect(db.lifecycleState.byProjectId('nope')).toBeNull();
  });

  it('lifecycleTasks insert + byProjectId round-trips', () => {
    const now = new Date().toISOString();
    db.lifecycleTasks.insert({
      id: 't1',
      projectId: 'demo-project',
      phase: 'research',
      title: 'Scan competitors',
      responsibleAgentId: 'product-competitor-research',
      status: 'open',
      blockedReason: null,
      createdAt: now,
      updatedAt: now,
    });
    const rows = db.lifecycleTasks.byProjectId('demo-project');
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Scan competitors');
  });

  it('lifecycleTasks.updateStatus mutates status and blockedReason', () => {
    const now = new Date().toISOString();
    db.lifecycleTasks.insert({
      id: 't2',
      projectId: 'demo-project',
      phase: 'research',
      title: 'x',
      responsibleAgentId: 'a',
      status: 'open',
      blockedReason: null,
      createdAt: now,
      updatedAt: now,
    });
    db.lifecycleTasks.updateStatus('t2', 'blocked', 'waiting on API key');
    const rows = db.lifecycleTasks.byProjectId('demo-project');
    expect(rows[0].status).toBe('blocked');
    expect(rows[0].blockedReason).toBe('waiting on API key');
  });

  it('lifecycleApprovals insert + pending() lists only pending rows', () => {
    const now = new Date().toISOString();
    db.lifecycleApprovals.insert({
      id: 'a1',
      projectId: 'demo-project',
      phase: 'deployment_approval',
      title: 'Ship v1',
      description: 'ready to deploy',
      requestedByAgentId: 'chief-of-staff',
      status: 'pending',
      createdAt: now,
      decidedAt: null,
      decidedBy: null,
      notes: null,
    });
    expect(db.lifecycleApprovals.pending()).toHaveLength(1);
  });

  it('lifecycleApprovals.decide records the decision', () => {
    const now = new Date().toISOString();
    db.lifecycleApprovals.insert({
      id: 'a2',
      projectId: 'demo-project',
      phase: 'deployment_approval',
      title: 'Ship v1',
      description: '',
      requestedByAgentId: 'chief-of-staff',
      status: 'pending',
      createdAt: now,
      decidedAt: null,
      decidedBy: null,
      notes: null,
    });
    db.lifecycleApprovals.decide('a2', 'approved', 'local-ui', 'looks good');
    const row = db.lifecycleApprovals.byId('a2');
    expect(row?.status).toBe('approved');
    expect(row?.decidedBy).toBe('local-ui');
    expect(db.lifecycleApprovals.pending()).toHaveLength(0);
  });
});
