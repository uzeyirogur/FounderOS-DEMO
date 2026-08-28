import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { POST as promote } from '@/app/api/ideas/[id]/promote/route';
import { POST as createIdea } from '@/app/api/ideas/route';

/**
 * The idea -> project seam: any idea (regardless of which project it came
 * from researching, or none at all) can be promoted into a REAL Project
 * Registry entry. This is what makes the standard lifecycle (idea -> research
 * -> validation -> planning -> development -> QA/security/UI review -> launch
 * -> growth/marketing -> monitoring -> iteration -> executive reporting)
 * project-agnostic: the same promote step works whether the idea came from
 * TIVARO, Is Ilan Radar, or something not yet registered anywhere.
 */
let dir: string;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idea-promote-'));
  process.env.FOUNDER_OS_DB = path.join(dir, 'test.db');
});

afterAll(() => {
  delete process.env.FOUNDER_OS_DB;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('POST /api/ideas/[id]/promote', () => {
  it('creates a real Project Registry entry and links the idea to it', async () => {
    const createRes = await createIdea(
      new Request('http://x/api/ideas', {
        method: 'POST',
        body: JSON.stringify({ title: 'Weekend Idea', marketSize: 5, effort: 5, strategicFit: 5 }),
      }),
    );
    const { idea } = (await createRes.json()) as { idea: { id: string } };

    const res = await promote(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Weekend Idea',
          kind: 'local',
          pathOrUrl: 'C:/tmp/weekend-idea',
          purpose: 'Turning the idea into a real project.',
        }),
      }),
      { params: { id: idea.id } },
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { idea: { projectId: string | null }; project: { id: string; permissionLevel: string; authorizedAgentIds: string[] } };
    expect(body.idea.projectId).toBe(body.project.id);
    expect(body.project.permissionLevel).toBe('read_only');
    expect(body.project.authorizedAgentIds).toEqual([]);
  });

  it('404s promoting an idea that does not exist', async () => {
    const res = await promote(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ name: 'x', kind: 'local', pathOrUrl: 'C:/x' }) }),
      { params: { id: 'nope' } },
    );
    expect(res.status).toBe(404);
  });

  it('400s when the promote body is missing required project fields', async () => {
    const createRes = await createIdea(
      new Request('http://x/api/ideas', {
        method: 'POST',
        body: JSON.stringify({ title: 'Another Idea', marketSize: 3, effort: 3, strategicFit: 3 }),
      }),
    );
    const { idea } = (await createRes.json()) as { idea: { id: string } };
    const res = await promote(new Request('http://x', { method: 'POST', body: JSON.stringify({}) }), { params: { id: idea.id } });
    expect(res.status).toBe(400);
  });
});
