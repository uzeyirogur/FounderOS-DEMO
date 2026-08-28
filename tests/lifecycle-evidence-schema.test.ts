import { describe, it, expect } from 'vitest';
import { LifecycleEvidenceSchema } from '@/lib/schemas';

describe('LifecycleEvidenceSchema', () => {
  it('accepts a full evidence record', () => {
    const evidence = {
      id: 'e1',
      projectId: 'proj-1',
      phase: 'implementation',
      kind: 'build_test',
      ok: true,
      summary: 'build succeeded, 12/12 tests passed',
      recordedByAgentId: 'claude-code-orchestrator',
      recordedAt: new Date().toISOString(),
    };
    expect(LifecycleEvidenceSchema.parse(evidence)).toMatchObject(evidence);
  });

  it('ok defaults to false — evidence is not a pass until explicitly marked so', () => {
    const evidence = LifecycleEvidenceSchema.parse({
      id: 'e2',
      projectId: 'proj-1',
      phase: 'qa',
      kind: 'qa_report',
      summary: 'x',
      recordedByAgentId: 'qa-ui-review',
      recordedAt: new Date().toISOString(),
    });
    expect(evidence.ok).toBe(false);
  });
});
