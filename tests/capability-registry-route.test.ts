import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GET as listCapabilities } from '@/app/api/capabilities/route';
import { POST as discover } from '@/app/api/capabilities/discover/route';
import { POST as approve } from '@/app/api/capabilities/[id]/approve/route';
import { POST as reject } from '@/app/api/capabilities/[id]/reject/route';

vi.mock('@/lib/connectors/web-search', () => ({
  braveSearch: vi.fn().mockResolvedValue([
    { title: 'Runway Gen-4', url: 'https://runwayml.com/gen-4', description: 'video gen, paid subscription' },
  ]),
}));

let dir: string;
const originalKey = process.env.BRAVE_SEARCH_API_KEY;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'capabilities-route-'));
  process.env.FOUNDER_OS_DB = path.join(dir, 'test.db');
  process.env.BRAVE_SEARCH_API_KEY = 'test-key';
});
afterAll(() => {
  delete process.env.FOUNDER_OS_DB;
  if (originalKey === undefined) delete process.env.BRAVE_SEARCH_API_KEY;
  else process.env.BRAVE_SEARCH_API_KEY = originalKey;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('GET /api/capabilities', () => {
  it('starts empty', async () => {
    const res = await listCapabilities();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.capabilities).toEqual([]);
  });
});

describe('POST /api/capabilities/discover', () => {
  it('discovers and persists candidates', async () => {
    const res = await discover(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ capability: 'video-generation', searchQuery: 'AI video generation API' }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.readyNow).toBe(false);
    expect(body.candidates).toHaveLength(1);
    expect(body.candidates[0].status).toBe('candidate');
    expect(body.candidates[0].approvedByUser).toBe(false);
  });

  it('400s on a missing capability field', async () => {
    const res = await discover(new Request('http://x', { method: 'POST', body: JSON.stringify({}) }));
    expect(res.status).toBe(400);
  });
});

describe('capability approve/reject', () => {
  it('approve flips status to active and sets allowedAgents; never happens without this explicit call', async () => {
    const listed = await (await listCapabilities()).json();
    const candidate = listed.capabilities.find((c: any) => c.capability === 'video-generation');
    expect(candidate.status).toBe('candidate');

    const res = await approve(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ allowedAgents: ['social-content-studio'] }) }),
      { params: { id: candidate.id } },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.capability.status).toBe('active');
    expect(body.capability.approvedByUser).toBe(true);
    expect(body.capability.allowedAgents).toEqual(['social-content-studio']);
  });

  it('404s approving an unknown id', async () => {
    const res = await approve(new Request('http://x', { method: 'POST', body: '{}' }), { params: { id: 'nope' } });
    expect(res.status).toBe(404);
  });

  it('reject marks a candidate rejected with notes', async () => {
    const discoverRes = await discover(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ capability: 'other-thing', searchQuery: 'q' }),
      }),
    );
    const { candidates } = await discoverRes.json();
    const res = await reject(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ notes: 'too expensive' }) }),
      { params: { id: candidates[0].id } },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.capability.status).toBe('rejected');
    expect(body.capability.notes).toBe('too expensive');
  });
});
