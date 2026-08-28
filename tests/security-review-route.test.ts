import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let dir: string;
let projectDir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-route-'));
  process.env.FOUNDER_OS_DB = path.join(dir, 'test.db');
  projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-route-proj-'));
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"x","version":"1.0.0"}');
});
afterAll(() => {
  delete process.env.FOUNDER_OS_DB;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(projectDir, { recursive: true, force: true });
});

vi.mock('@/lib/security-review', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/security-review')>();
  return { ...actual, runNpmAuditLive: vi.fn().mockResolvedValue({ total: 0, info: 0, low: 0, moderate: 0, high: 0, critical: 0, ok: true }) };
});

import { POST as securityReview } from '@/app/api/security-review/route';
import { getDb } from '@/lib/data';

describe('POST /api/security-review', () => {
  it('404s a project that does not exist', async () => {
    const res = await securityReview(new Request('http://x', { method: 'POST', body: JSON.stringify({ projectId: 'nope' }) }));
    expect(res.status).toBe(404);
  });

  it('403s a project that does not authorize security-reviewer', async () => {
    getDb().projects.insert({
      id: 'proj-unauthorized', name: 'Unauthorized', kind: 'local', pathOrUrl: projectDir, purpose: '',
      status: 'active', permissionLevel: 'read_only', authorizedAgentIds: [], createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), origin: 'os',
    } as any);
    const res = await securityReview(new Request('http://x', { method: 'POST', body: JSON.stringify({ projectId: 'proj-unauthorized' }) }));
    expect(res.status).toBe(403);
  });

  it('runs a real review against an authorized active local project', async () => {
    getDb().projects.insert({
      id: 'proj-authorized', name: 'Authorized', kind: 'local', pathOrUrl: projectDir, purpose: '',
      status: 'active', permissionLevel: 'read_only', authorizedAgentIds: ['security-reviewer'], createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), origin: 'os',
    } as any);
    const res = await securityReview(new Request('http://x', { method: 'POST', body: JSON.stringify({ projectId: 'proj-authorized' }) }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.report.ok).toBe(true);
    expect(body.report.secrets).toEqual([]);
  });
});
