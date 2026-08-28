import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getDb } from '@/lib/data';
import { POST as dispatch } from '@/app/api/claude-code/dispatch/route';
import { POST as execute } from '@/app/api/claude-code/runs/[id]/execute/route';
import { POST as approveRun } from '@/app/api/claude-code/runs/[id]/approve/route';

vi.mock('@/lib/claude-code-dispatch-exec', () => ({
  dispatchClaudeCodeLiveExecFn: vi.fn().mockResolvedValue({
    stdout: JSON.stringify({ type: 'result', subtype: 'success', result: 'done', session_id: 's1', num_turns: 1, total_cost_usd: 0.01 }),
    stderr: '',
  }),
}));

let dir: string;
let projectDir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-execute-route-'));
  process.env.FOUNDER_OS_DB = path.join(dir, 'test.db');
  projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-execute-proj-'));
});
afterAll(() => {
  delete process.env.FOUNDER_OS_DB;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(projectDir, { recursive: true, force: true });
});

describe('POST /api/claude-code/runs/[id]/execute', () => {
  it('404s an unknown run', async () => {
    const res = await execute(new Request('http://x', { method: 'POST' }), { params: Promise.resolve({ id: 'nope' }) });
    expect(res.status).toBe(404);
  });

  it('409s a run still awaiting approval — never reaches the (mocked) claude call', async () => {
    getDb().projects.insert({
      id: 'proj-exec-full', name: 'Full', kind: 'local', pathOrUrl: projectDir, purpose: '',
      status: 'active', permissionLevel: 'full_with_approval', authorizedAgentIds: ['claude-code-orchestrator'], createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), origin: 'os',
    } as any);
    const queued = await (
      await dispatch(new Request('http://x', { method: 'POST', body: JSON.stringify({ projectId: 'proj-exec-full', goal: 'refactor' }) }))
    ).json();
    const res = await execute(new Request('http://x', { method: 'POST' }), { params: Promise.resolve({ id: queued.run.id }) });
    expect(res.status).toBe(409);
  });

  it('executes a queued run for real (exec mocked module-wide — no real cost) and records the outcome', async () => {
    getDb().projects.insert({
      id: 'proj-exec-ro', name: 'Read Only', kind: 'local', pathOrUrl: projectDir, purpose: '',
      status: 'active', permissionLevel: 'read_only', authorizedAgentIds: ['claude-code-orchestrator'], createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), origin: 'os',
    } as any);
    const queued = await (
      await dispatch(new Request('http://x', { method: 'POST', body: JSON.stringify({ projectId: 'proj-exec-ro', goal: 'list files' }) }))
    ).json();
    const res = await execute(new Request('http://x', { method: 'POST' }), { params: Promise.resolve({ id: queued.run.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.run.status).toBe('done');
    expect(body.run.resultSummary).toBe('done');
  });

  it('approving a full_with_approval run then executing it works end to end', async () => {
    getDb().projects.insert({
      id: 'proj-exec-full2', name: 'Full2', kind: 'local', pathOrUrl: projectDir, purpose: '',
      status: 'active', permissionLevel: 'full_with_approval', authorizedAgentIds: ['claude-code-orchestrator'], createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), origin: 'os',
    } as any);
    const queued = await (
      await dispatch(new Request('http://x', { method: 'POST', body: JSON.stringify({ projectId: 'proj-exec-full2', goal: 'refactor' }) }))
    ).json();
    await approveRun(new Request('http://x', { method: 'POST' }), { params: Promise.resolve({ id: queued.run.id }) });
    const res = await execute(new Request('http://x', { method: 'POST' }), { params: Promise.resolve({ id: queued.run.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.run.status).toBe('done');
  });
});
