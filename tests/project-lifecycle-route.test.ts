import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GET as getLifecycle } from '@/app/api/projects/[id]/lifecycle/route';
import { POST as advance } from '@/app/api/projects/[id]/lifecycle/advance/route';
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
});

describe('lifecycle approval gate end-to-end via the API', () => {
  it('blocks advancing past deployment_approval until decided, then allows it', async () => {
    const id = await makeProject('Lifecycle Route Project C');
    // walk it up to deployment_approval (idea -> research -> validation ->
    // product_planning -> technical_planning -> implementation -> qa ->
    // security -> ui_ux -> launch_readiness -> deployment_approval)
    // idea is index 0, deployment_approval is index 10 -> 10 advances
    let last;
    for (let i = 0; i < 10; i++) {
      last = await advance(new Request('http://x', { method: 'POST', body: '{}' }), { params: { id } });
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
