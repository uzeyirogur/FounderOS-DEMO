import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDb } from '@/lib/db';
import { getOrCreateLifecycleState, advancePhase, recordEvidence } from '@/lib/project-lifecycle-orchestrator';

/**
 * Evidence-gated phases (per PHASE_EXIT_EVIDENCE): a phase is not "done"
 * because an agent said so — advancePhase refuses to leave implementation/
 * qa/security/ui_ux/launch_readiness without a matching evidence row whose
 * `ok` is true. This is the "entry/exit criteria" requirement, applied as
 * a structural gate rather than a checklist nobody reads.
 */
describe('project-lifecycle-orchestrator — evidence gating', () => {
  let db: ReturnType<typeof openDb>;

  beforeEach(() => {
    db = openDb(':memory:');
  });

  afterEach(() => {
    (db as any).close?.();
  });

  it('refuses to leave implementation with no evidence recorded at all', () => {
    db.lifecycleState.upsert({
      projectId: 'proj-x',
      currentPhase: 'implementation',
      history: [{ phase: 'implementation', enteredAt: new Date().toISOString() }],
      updatedAt: new Date().toISOString(),
    });
    const result = advancePhase(db, 'proj-x', 'claude-code-orchestrator');
    if (result.ok) throw new Error('expected advancePhase to be blocked');
    expect(result.reason).toMatch(/evidence/i);
  });

  it('refuses to leave implementation when the only evidence is a failing build_test', () => {
    db.lifecycleState.upsert({
      projectId: 'proj-y',
      currentPhase: 'implementation',
      history: [{ phase: 'implementation', enteredAt: new Date().toISOString() }],
      updatedAt: new Date().toISOString(),
    });
    recordEvidence(db, {
      projectId: 'proj-y',
      phase: 'implementation',
      kind: 'build_test',
      ok: false,
      summary: 'build failed: TS2345',
      recordedByAgentId: 'claude-code-orchestrator',
    });
    const result = advancePhase(db, 'proj-y', 'claude-code-orchestrator');
    if (result.ok) throw new Error('expected advancePhase to be blocked');
    expect(result.reason).toMatch(/evidence/i);
  });

  it('allows leaving implementation once a passing build_test evidence row exists', () => {
    db.lifecycleState.upsert({
      projectId: 'proj-z',
      currentPhase: 'implementation',
      history: [{ phase: 'implementation', enteredAt: new Date().toISOString() }],
      updatedAt: new Date().toISOString(),
    });
    recordEvidence(db, {
      projectId: 'proj-z',
      phase: 'implementation',
      kind: 'build_test',
      ok: true,
      summary: 'build succeeded, 40/40 tests passed',
      recordedByAgentId: 'claude-code-orchestrator',
    });
    const result = advancePhase(db, 'proj-z', 'claude-code-orchestrator');
    expect(result.ok).toBe(true);
    expect(result.state?.currentPhase).toBe('qa');
  });

  it('a later passing evidence row overrides an earlier failing one', () => {
    db.lifecycleState.upsert({
      projectId: 'proj-w',
      currentPhase: 'qa',
      history: [{ phase: 'qa', enteredAt: new Date().toISOString() }],
      updatedAt: new Date().toISOString(),
    });
    recordEvidence(db, { projectId: 'proj-w', phase: 'qa', kind: 'qa_report', ok: false, summary: '2 tests failed', recordedByAgentId: 'qa-ui-review' });
    const blocked = advancePhase(db, 'proj-w', 'qa-ui-review');
    if (blocked.ok) throw new Error('expected blocked');
    recordEvidence(db, { projectId: 'proj-w', phase: 'qa', kind: 'qa_report', ok: true, summary: 'all green now', recordedByAgentId: 'qa-ui-review' });
    const allowed = advancePhase(db, 'proj-w', 'qa-ui-review');
    expect(allowed.ok).toBe(true);
  });

  it('phases with no evidence requirement (idea) still advance freely', () => {
    getOrCreateLifecycleState(db, 'proj-v');
    const result = advancePhase(db, 'proj-v', 'conductor');
    expect(result.ok).toBe(true);
    expect(result.state?.currentPhase).toBe('research');
  });

  it('recordEvidence refuses an evidence kind that does not match the phase', () => {
    expect(() =>
      recordEvidence(db, { projectId: 'proj-u', phase: 'qa', kind: 'build_test' as any, ok: true, summary: 'x', recordedByAgentId: 'a' }),
    ).toThrow();
  });
});
