import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getDb } from '@/lib/data';

vi.mock('@/lib/qa-review-orchestrator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/qa-review-orchestrator')>();
  return {
    ...actual,
    runQaReviewLive: vi.fn().mockResolvedValue({
      test: { total: 5, passed: 5, failed: 0, failedFiles: [] },
      typecheck: { errorCount: 0, ok: true },
      build: { ok: true, detail: 'Compiled successfully' },
      ok: true,
    }),
  };
});

let dir: string;
let projectDir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-review-route-'));
  process.env.FOUNDER_OS_DB = path.join(dir, 'test.db');
  projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-review-proj-'));
});
afterAll(() => {
  delete process.env.FOUNDER_OS_DB;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(projectDir, { recursive: true, force: true });
});

describe('POST /api/qa-review', () => {
  it('404s a project that does not exist', async () => {
    const { POST } = await import('@/app/api/qa-review/route');
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ projectId: 'nope' }) }));
    expect(res.status).toBe(404);
  });

  it('403s a project that does not authorize qa-ui-review', async () => {
    getDb().projects.insert({
      id: 'proj-unauthorized-qa', name: 'Unauthorized', kind: 'local', pathOrUrl: projectDir, purpose: '',
      status: 'active', permissionLevel: 'read_only', authorizedAgentIds: [], createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), origin: 'os',
    } as any);
    const { POST } = await import('@/app/api/qa-review/route');
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ projectId: 'proj-unauthorized-qa' }) }));
    expect(res.status).toBe(403);
  });

  it('runs a real review against an authorized active local project (npm scripts mocked)', async () => {
    getDb().projects.insert({
      id: 'proj-authorized-qa', name: 'Authorized', kind: 'local', pathOrUrl: projectDir, purpose: '',
      status: 'active', permissionLevel: 'read_only', authorizedAgentIds: ['qa-ui-review'], createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), origin: 'os',
    } as any);
    const { POST } = await import('@/app/api/qa-review/route');
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ projectId: 'proj-authorized-qa' }) }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.report.ok).toBe(true);
  });
});
