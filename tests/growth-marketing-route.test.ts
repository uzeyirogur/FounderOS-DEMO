import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GET as listBriefs } from '@/app/api/growth-briefs/route';
import { POST as research } from '@/app/api/growth-briefs/research/route';
import { POST as createProject } from '@/app/api/projects/route';

vi.mock('@/lib/connectors/web-search', () => ({
  braveSearch: vi.fn().mockResolvedValue([
    { title: 'Competitor A', url: 'https://a.example', description: 'A youth sports app.' },
  ]),
}));

let dir: string;
const originalKey = process.env.BRAVE_SEARCH_API_KEY;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'growth-route-'));
  process.env.FOUNDER_OS_DB = path.join(dir, 'test.db');
  process.env.BRAVE_SEARCH_API_KEY = 'test-key';
});
afterAll(() => {
  delete process.env.FOUNDER_OS_DB;
  if (originalKey === undefined) delete process.env.BRAVE_SEARCH_API_KEY;
  else process.env.BRAVE_SEARCH_API_KEY = originalKey;
  fs.rmSync(dir, { recursive: true, force: true });
});

async function makeProject(name: string): Promise<string> {
  const res = await createProject(
    new Request('http://x', { method: 'POST', body: JSON.stringify({ name, kind: 'local', pathOrUrl: 'C:/tmp/' + name }) }),
  );
  const { project } = (await res.json()) as { project: { id: string } };
  return project.id;
}

describe('GET /api/growth-briefs', () => {
  it('starts empty', async () => {
    const body = await (await listBriefs()).json();
    expect(body.briefs).toEqual([]);
  });
});

describe('POST /api/growth-briefs/research', () => {
  it('researches and persists a brief for a real project', async () => {
    const projectId = await makeProject('Growth Route Project');
    const res = await research(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ projectId, focus: 'competitor', query: 'q' }) }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.brief.projectId).toBe(projectId);
    expect(body.brief.sources).toHaveLength(1);
  });

  it('404s for an unknown project', async () => {
    const res = await research(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ projectId: 'nope', focus: 'seo', query: 'q' }) }),
    );
    expect(res.status).toBe(404);
  });

  it('400s on an invalid focus', async () => {
    const projectId = await makeProject('Growth Route Project 2');
    const res = await research(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ projectId, focus: 'not-a-real-focus', query: 'q' }) }),
    );
    expect(res.status).toBe(400);
  });
});
