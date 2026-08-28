import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getDb } from '@/lib/data';
import { POST as dispatch } from '@/app/api/claude-code/dispatch/route';

vi.mock('@/lib/claude-code-dispatch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/claude-code-dispatch')>();
  return {
    ...actual,
    dispatchClaudeCodeLive: vi.fn().mockResolvedValue({ ok: true, result: 'done', sessionId: 's1', numTurns: 1, totalCostUsd: 0.01 }),
  };
});

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

describe('POST /api/claude-code/dispatch', () => {
  it('404s a project that does not exist', async () => {
    const res = await dispatch(new Request('http://x', { method: 'POST', body: JSON.stringify({ projectId: 'nope', prompt: 'x' }) }));
    expect(res.status).toBe(404);
  });

  it('403s a project that does not authorize claude-code-orchestrator — never reaches the (mocked) claude call', async () => {
    getDb().projects.insert({
      id: 'proj-unauthorized-cc', name: 'Unauthorized', kind: 'local', pathOrUrl: projectDir, purpose: '',
      status: 'active', permissionLevel: 'read_only', authorizedAgentIds: [], createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), origin: 'os',
    } as any);
    const res = await dispatch(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ projectId: 'proj-unauthorized-cc', prompt: 'x' }) }),
    );
    expect(res.status).toBe(403);
  });

  it('dispatches to the real wiring for an authorized project (claude call mocked module-wide — no real cost)', async () => {
    getDb().projects.insert({
      id: 'proj-authorized-cc', name: 'Authorized', kind: 'local', pathOrUrl: projectDir, purpose: '',
      status: 'active', permissionLevel: 'read_only', authorizedAgentIds: ['claude-code-orchestrator'], createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), origin: 'os',
    } as any);
    const res = await dispatch(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ projectId: 'proj-authorized-cc', prompt: 'list files' }) }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.ok).toBe(true);
  });
});
