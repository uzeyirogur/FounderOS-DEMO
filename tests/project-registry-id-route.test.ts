import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PATCH, DELETE } from '@/app/api/projects/[id]/route';
import { POST } from '@/app/api/projects/route';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'proj-id-route-'));
  process.env.FOUNDER_OS_DB = path.join(dir, 'test.db');
});

afterEach(() => {
  delete process.env.FOUNDER_OS_DB;
  fs.rmSync(dir, { recursive: true, force: true });
});

const create = async () => {
  const res = await POST(
    new Request('http://x/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Widget Factory', kind: 'local', pathOrUrl: 'C:/x' }),
    }),
  );
  const { project } = (await res.json()) as { project: { id: string } };
  return project.id;
};

describe('PATCH /api/projects/[id]', () => {
  it('updates permissionLevel and authorizedAgentIds', async () => {
    const id = await create();
    const res = await PATCH(
      new Request(`http://x/api/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ permissionLevel: 'auto_safe_write', authorizedAgentIds: ['claude-code-orchestrator'] }),
      }),
      { params: { id } },
    );
    expect(res.status).toBe(200);
    const { project } = (await res.json()) as { project: Record<string, unknown> };
    expect(project.permissionLevel).toBe('auto_safe_write');
    expect(project.authorizedAgentIds).toEqual(['claude-code-orchestrator']);
  });

  it('id and origin are not editable', async () => {
    const id = await create();
    const res = await PATCH(
      new Request(`http://x/api/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Renamed' }),
      }),
      { params: { id } },
    );
    const { project } = (await res.json()) as { project: { id: string; origin: string; name: string } };
    expect(project.id).toBe(id);
    expect(project.origin).toBe('os');
    expect(project.name).toBe('Renamed');
  });

  it('404s on an unknown id', async () => {
    const res = await PATCH(
      new Request('http://x/api/projects/nope', { method: 'PATCH', body: JSON.stringify({ status: 'paused' }) }),
      { params: { id: 'nope' } },
    );
    expect(res.status).toBe(404);
  });

  it('400s on an unknown permissionLevel', async () => {
    const id = await create();
    const res = await PATCH(
      new Request(`http://x/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify({ permissionLevel: 'god-mode' }) }),
      { params: { id } },
    );
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/projects/[id]', () => {
  it('removes a project', async () => {
    const id = await create();
    const res = await DELETE(new Request(`http://x/api/projects/${id}`, { method: 'DELETE' }), { params: { id } });
    expect(res.status).toBe(200);
  });

  it('404s on an unknown id', async () => {
    const res = await DELETE(new Request('http://x/api/projects/nope', { method: 'DELETE' }), { params: { id: 'nope' } });
    expect(res.status).toBe(404);
  });
});
