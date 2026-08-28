import { describe, it, expect } from 'vitest';
import { openDb } from '@/lib/db';

describe('db.lifecycleEvidence', () => {
  it('inserts and reads back evidence', () => {
    const db = openDb(':memory:');
    db.lifecycleEvidence.insert({
      id: 'e1', projectId: 'proj-1', phase: 'implementation', kind: 'build_test',
      ok: true, summary: 'build ok, 12/12 tests', recordedByAgentId: 'claude-code-orchestrator',
      recordedAt: new Date().toISOString(),
    });
    const all = db.lifecycleEvidence.byProjectId('proj-1');
    expect(all).toHaveLength(1);
    expect(all[0].ok).toBe(true);
  });

  it('byProjectPhase filters to one phase, newest first', () => {
    const db = openDb(':memory:');
    db.lifecycleEvidence.insert({
      id: 'e1', projectId: 'proj-1', phase: 'implementation', kind: 'build_test',
      ok: false, summary: 'build failed', recordedByAgentId: 'a', recordedAt: '2026-01-01T00:00:00.000Z',
    });
    db.lifecycleEvidence.insert({
      id: 'e2', projectId: 'proj-1', phase: 'implementation', kind: 'build_test',
      ok: true, summary: 'fixed, build ok', recordedByAgentId: 'a', recordedAt: '2026-01-02T00:00:00.000Z',
    });
    db.lifecycleEvidence.insert({
      id: 'e3', projectId: 'proj-1', phase: 'qa', kind: 'qa_report',
      ok: true, summary: 'all green', recordedByAgentId: 'a', recordedAt: '2026-01-03T00:00:00.000Z',
    });
    const impl = db.lifecycleEvidence.byProjectPhase('proj-1', 'implementation');
    expect(impl.map((e) => e.id)).toEqual(['e2', 'e1']);
  });
});
