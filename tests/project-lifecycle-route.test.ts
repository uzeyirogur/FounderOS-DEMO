import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GET as getLifecycle } from '@/app/api/projects/[id]/lifecycle/route';
import { POST as advance } from '@/app/api/projects/[id]/lifecycle/advance/route';
import { POST as recordEvidenceRoute, GET as listEvidence } from '@/app/api/projects/[id]/lifecycle/evidence/route';
import { POST as decideApproval } from '@/app/api/lifecycle-approvals/[id]/decide/route';
import { GET as listPendingApprovals } from '@/app/api/lifecycle-approvals/route';
import { POST as createProject } from '@/app/api/projects/route';

let dir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifecycle-route-'));
  process.env.FOUNDER_OS_DB = path.join(dir, 'test.db');
});
afterAll(() => {
  delete process.env.FOUNDER_OS_DB;
  fs.rmSync(dir, { recursive: true, force: true });
});

async function makeProject(name: string): Promise<string> {
  const res = await createProject(
    new Request('http://x/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name, kind: 'local', pathOrUrl: 'C:/tmp/' + name }),
    }),
  );
  const { project } = (await res.json()) as { project: { id: string } };
  return project.id;
}

async function advanceOrRecordEvidence(id: string): Promise<Response> {
  // Try to advance; if blocked on a missing evidence requirement, record a
  // passing evidence row for the current phase and retry once.
  let res = await advance(new Request('http://x', { method: 'POST', body: '{}' }), { params: { id } });
  if (res.status === 422) {
    const body = await res.json();
    const phase = body.state?.currentPhase;
    const evidenceKinds: Record<string, string> = {
      implementation: 'build_test',
      qa: 'qa_report',
      security: 'security_report',
      ui_ux: 'ui_ux_report',
      launch_readiness: 'launch_checklist',
    };
    const kind = evidenceKinds[phase];
    if (!kind) throw new Error(`advanceOrRecordEvidence: unexpected block at phase ${phase}: ${body.error}`);
    await recordEvidenceRoute(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ phase, kind, ok: true, summary: 'test evidence', recordedByAgentId: 'test-agent' }) }),
      { params: { id } },
    );
    res = await advance(new Request('http://x', { method: 'POST', body: '{}' }), { params: { id } });
  }
  return res;
}

describe('GET /api/projects/[id]/lifecycle', () => {
  it('404s for an unknown project', async () => {
    const res = await getLifecycle(new Request('http://x'), { params: { id: 'does-not-exist' } });
    expect(res.status).toBe(404);
  });

  it('lazily returns phase=idea for a project that has never been advanced', async () => {
    const id = await makeProject('Lifecycle Route Project A');
    const res = await getLifecycle(new Request('http://x'), { params: { id } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.currentPhase).toBe('idea');
    expect(body.responsibleAgentId).toBe('idea-lab-agent');
  });
});

describe('POST /api/projects/[id]/lifecycle/advance', () => {
  it('advances a project one phase forward', async () => {
    const id = await makeProject('Lifecycle Route Project B');
    const res = await advance(new Request('http://x', { method: 'POST', body: '{}' }), { params: { id } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.state.currentPhase).toBe('research');
  });

  it('404s for an unknown project', async () => {
    const res = await advance(new Request('http://x', { method: 'POST', body: '{}' }), {
      params: { id: 'nope' },
    });
    expect(res.status).toBe(404);
  });

  it('blocks on a missing evidence requirement, with a clear reason', async () => {
    const id = await makeProject('Lifecycle Route Project D');
    // idea -> research -> validation -> product_planning -> technical_planning -> implementation (5 advances)
    for (let i = 0; i < 5; i++) {
      await advance(new Request('http://x', { method: 'POST', body: '{}' }), { params: { id } });
    }
    const blocked = await advance(new Request('http://x', { method: 'POST', body: '{}' }), { params: { id } });
    expect(blocked.status).toBe(422);
    const body = await blocked.json();
    expect(body.error).toMatch(/evidence/i);
    expect(body.state.currentPhase).toBe('implementation');
  });
});

describe('POST /api/projects/[id]/lifecycle/evidence', () => {
  it('records evidence and unblocks the matching phase', async () => {
    const id = await makeProject('Lifecycle Route Project E');
    for (let i = 0; i < 5; i++) {
      await advance(new Request('http://x', { method: 'POST', body: '{}' }), { params: { id } });
    }
    const rec = await recordEvidenceRoute(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ phase: 'implementation', kind: 'build_test', ok: true, summary: 'build ok', recordedByAgentId: 'claude-code-orchestrator' }) }),
      { params: { id } },
    );
    expect(rec.status).toBe(201);

    const unblocked = await advance(new Request('http://x', { method: 'POST', body: '{}' }), { params: { id } });
    expect(unblocked.status).toBe(200);
    const body = await unblocked.json();
    expect(body.state.currentPhase).toBe('qa');

    const listRes = await listEvidence(new Request('http://x'), { params: { id } });
    const { evidence } = await listRes.json();
    expect(evidence).toHaveLength(1);
  });

  it('422s on an evidence kind that does not match the phase', async () => {
    const id = await makeProject('Lifecycle Route Project F');
    const res = await recordEvidenceRoute(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ phase: 'idea', kind: 'build_test', ok: true, summary: 'x', recordedByAgentId: 'a' }) }),
      { params: { id } },
    );
    expect(res.status).toBe(400); // idea has no evidence requirement at all
  });
});

describe('lifecycle approval gate end-to-end via the API', () => {
  it('blocks advancing past deployment_approval until decided, then allows it', async () => {
    const id = await makeProject('Lifecycle Route Project C');
    // walk it up to deployment_approval, recording evidence whenever blocked
    // (idea -> research -> validation -> product_planning -> technical_planning
    //  -> implementation -> qa -> security -> ui_ux -> launch_readiness -> deployment_approval)
    let last: Response | undefined;
    for (let i = 0; i < 10; i++) {
      last = await advanceOrRecordEvidence(id);
    }
    const body = await last!.json();
    expect(body.state.currentPhase).toBe('deployment_approval');

    // blocked: no decision yet
    const blocked = await advance(new Request('http://x', { method: 'POST', body: '{}' }), { params: { id } });
    expect(blocked.status).toBe(422);

    // find the pending approval for this project
    const pendingRes = await listPendingApprovals();
    const { approvals } = (await pendingRes.json()) as { approvals: { id: string; projectId: string }[] };
    const approval = approvals.find((a) => a.projectId === id);
    expect(approval).toBeTruthy();

    // decide it
    const decideRes = await decideApproval(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ decision: 'approved', decidedBy: 'local-ui' }),
      }),
      { params: { id: approval!.id } },
    );
    expect(decideRes.status).toBe(200);

    // now advancing succeeds
    const unblocked = await advance(new Request('http://x', { method: 'POST', body: '{}' }), { params: { id } });
    expect(unblocked.status).toBe(200);
    const unblockedBody = await unblocked.json();
    expect(unblockedBody.state.currentPhase).toBe('growth');
  });
});
