import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { POST as uiUxReview } from '@/app/api/ui-ux-review/route';
import { getDb } from '@/lib/data';

let dir: string;
let projectDir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uiux-route-'));
  process.env.FOUNDER_OS_DB = path.join(dir, 'test.db');
  projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uiux-route-proj-'));
  fs.writeFileSync(path.join(projectDir, 'a.tsx'), '<img src="x.png" />');
});
afterAll(() => {
  delete process.env.FOUNDER_OS_DB;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(projectDir, { recursive: true, force: true });
});

describe('POST /api/ui-ux-review', () => {
  it('404s a project that does not exist', async () => {
    const res = await uiUxReview(new Request('http://x', { method: 'POST', body: JSON.stringify({ projectId: 'nope' }) }));
    expect(res.status).toBe(404);
  });

  it('403s a project that does not authorize ui-ux-reviewer', async () => {
    getDb().projects.insert({
      id: 'proj-unauthorized-ux', name: 'Unauthorized', kind: 'local', pathOrUrl: projectDir, purpose: '',
      status: 'active', permissionLevel: 'read_only', authorizedAgentIds: [], createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), origin: 'os',
    } as any);
    const res = await uiUxReview(new Request('http://x', { method: 'POST', body: JSON.stringify({ projectId: 'proj-unauthorized-ux' }) }));
    expect(res.status).toBe(403);
  });

  it('runs a real scan against an authorized active local project and finds the real defect', async () => {
    getDb().projects.insert({
      id: 'proj-authorized-ux', name: 'Authorized', kind: 'local', pathOrUrl: projectDir, purpose: '',
      status: 'active', permissionLevel: 'read_only', authorizedAgentIds: ['ui-ux-reviewer'], createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), origin: 'os',
    } as any);
    const res = await uiUxReview(new Request('http://x', { method: 'POST', body: JSON.stringify({ projectId: 'proj-authorized-ux' }) }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.report.ok).toBe(false);
    expect(body.report.findings[0].rule).toBe('img-missing-alt');
  });
});
