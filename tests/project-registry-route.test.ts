import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GET, POST } from '@/app/api/projects/route';

/**
 * POST /api/projects is how a project gets registered from inside the OS: a
 * form on /projects and (later) Project Bootstrap proposing a new repo both
 * post here. Same slugging + collision + validation contract as lead magnets.
 */
let dir: string;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'proj-route-'));
  process.env.FOUNDER_OS_DB = path.join(dir, 'test.db');
});

afterAll(() => {
  delete process.env.FOUNDER_OS_DB;
  fs.rmSync(dir, { recursive: true, force: true });
});

const post = (body: unknown) =>
  POST(new Request('http://x/api/projects', { method: 'POST', body: JSON.stringify(body) }));

describe('POST /api/projects', () => {
  it('creates one, slugs the id, defaults status/permission/origin', async () => {
    const res = await post({
      name: 'Test Widget Factory',
      kind: 'local',
      pathOrUrl: 'C:/Users/HP/source/repos/test-widget-factory',
      purpose: 'A project created purely for this test suite.',
    });
    expect(res.status).toBe(201);
    const { project } = (await res.json()) as { project: Record<string, unknown> };
    expect(project.id).toBe('test-widget-factory');
    expect(project.origin).toBe('os');
    expect(project.status).toBe('active');
    expect(project.permissionLevel).toBe('read_only');
    expect(project.authorizedAgentIds).toEqual([]);
  });

  it('never collides an id with an existing row', async () => {
    const res = await post({ name: 'Test Widget Factory', kind: 'local', pathOrUrl: 'C:/other/path' });
    const { project } = (await res.json()) as { project: { id: string } };
    expect(project.id).toBe('test-widget-factory-2');
  });

  it('accepts kind: git with a remote URL', async () => {
    const res = await post({
      name: 'İş İlan Radar',
      kind: 'git',
      pathOrUrl: 'https://github.com/example/is-ilan-radar.git',
    });
    expect(res.status).toBe(201);
    const { project } = (await res.json()) as { project: { kind: string } };
    expect(project.kind).toBe('git');
  });

  it('400s on an unknown kind', async () => {
    const res = await post({ name: 'Broken', kind: 'ftp', pathOrUrl: 'x' });
    expect(res.status).toBe(400);
  });

  it('400s when the name is missing', async () => {
    const res = await post({ kind: 'local', pathOrUrl: 'C:/x' });
    expect(res.status).toBe(400);
  });

  it('GET lists what was created', async () => {
    const body = (await (await GET()).json()) as { projects: { id: string }[] };
    expect(body.projects.map((p) => p.id)).toContain('test-widget-factory');
  });
});
