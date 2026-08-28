import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getDb } from '@/lib/data';
import { POST as dispatch, GET as listRuns } from '@/app/api/claude-code/dispatch/route';
import { POST as approveRun } from '@/app/api/claude-code/runs/[id]/approve/route';

let dir: string;
let projectDir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-dispatch-route-'));
  process.env.FOUNDER_OS_DB = path.join(dir, 'test.db');
  projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-dispatch-proj-'));
});
afterAll(() => {
  delete process.env.FOUNDER_OS_DB;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(projectDir, { recursive: true, force: true });
});

describe('POST /api/claude-code/dispatch — queues a run, never spends money directly', () => {
  it('404s a project that does not exist', async () => {
    const res = await dispatch(new Request('http://x', { method: 'POST', body: JSON.stringify({ projectId: 'nope', goal: 'x' }) }));
    expect(res.status).toBe(404);
  });

  it('403s a project that does not authorize claude-code-orchestrator — no run is queued', async () => {
    getDb().projects.insert({
      id: 'proj-unauthorized-cc', name: 'Unauthorized', kind: 'local', pathOrUrl: projectDir, purpose: '',
      status: 'active', permissionLevel: 'read_only', authorizedAgentIds: [], createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), origin: 'os',
    } as any);
    const res = await dispatch(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ projectId: 'proj-unauthorized-cc', goal: 'x' }) }),
    );
    expect(res.status).toBe(403);
  });

  it('queues a real run for a read_only-authorized project, no cost incurred', async () => {
    getDb().projects.insert({
      id: 'proj-authorized-cc', name: 'Authorized', kind: 'local', pathOrUrl: projectDir, purpose: '',
      status: 'active', permissionLevel: 'read_only', authorizedAgentIds: ['claude-code-orchestrator'], createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), origin: 'os',
    } as any);
    const res = await dispatch(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ projectId: 'proj-authorized-cc', goal: 'list files' }) }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.run.status).toBe('queued');
    expect(body.run.prompt).toContain('list files');

    const listRes = await listRuns(new Request('http://x/api/claude-code/dispatch?projectId=proj-authorized-cc'));
    const { runs } = await listRes.json();
    expect(runs).toHaveLength(1);
  });

  it('a full_with_approval project queues as awaiting_approval, and approve moves it to queued', async () => {
    getDb().projects.insert({
      id: 'proj-full-approval-cc', name: 'Full Approval', kind: 'local', pathOrUrl: projectDir, purpose: '',
      status: 'active', permissionLevel: 'full_with_approval', authorizedAgentIds: ['claude-code-orchestrator'], createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), origin: 'os',
    } as any);
    const res = await dispatch(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ projectId: 'proj-full-approval-cc', goal: 'refactor everything' }) }),
    );
    const body = await res.json();
    expect(body.run.status).toBe('awaiting_approval');

    const approveRes = await approveRun(new Request('http://x', { method: 'POST' }), { params: Promise.resolve({ id: body.run.id }) });
    const approveBody = await approveRes.json();
    expect(approveBody.run.status).toBe('queued');
  });
});
