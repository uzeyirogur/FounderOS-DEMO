import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GET as listBriefs } from '@/app/api/creative-briefs/route';
import { POST as researchBrief } from '@/app/api/creative-briefs/research/route';

let dir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'creative-briefs-route-'));
  process.env.FOUNDER_OS_DB = path.join(dir, 'test.db');
});
afterAll(() => {
  delete process.env.FOUNDER_OS_DB;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('GET /api/creative-briefs', () => {
  it('starts empty', async () => {
    const res = await listBriefs();
    const body = await res.json();
    expect(body.briefs).toEqual([]);
  });
});

describe('POST /api/creative-briefs/research', () => {
  it('400s on a missing field', async () => {
    const res = await researchBrief(new Request('http://x', { method: 'POST', body: JSON.stringify({ projectId: 'p1' }) }));
    expect(res.status).toBe(400);
  });

  it('422s honestly when BRAVE_SEARCH_API_KEY is not set', async () => {
    const prevKey = process.env.BRAVE_SEARCH_API_KEY;
    delete process.env.BRAVE_SEARCH_API_KEY;
    const res = await researchBrief(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ projectId: 'p1', format: 'short_video', query: 'q' }) }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/BRAVE_SEARCH_API_KEY/);
    if (prevKey) process.env.BRAVE_SEARCH_API_KEY = prevKey;
  });

  it('200s with a real brief when the search connector succeeds', async () => {
    process.env.BRAVE_SEARCH_API_KEY = 'test-key';
    vi.doMock('@/lib/connectors/web-search', () => ({
      braveSearch: vi.fn().mockResolvedValue([{ title: 'Real result', url: 'https://x.com', description: 'd' }]),
    }));
    const { POST: freshResearch } = await import('@/app/api/creative-briefs/research/route');
    const res = await freshResearch(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ projectId: 'p1', format: 'short_video', query: 'q' }) }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.brief.sources).toHaveLength(1);
    delete process.env.BRAVE_SEARCH_API_KEY;
    vi.doUnmock('@/lib/connectors/web-search');
  });
});
