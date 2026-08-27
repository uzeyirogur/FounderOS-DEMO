import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GET, POST } from '@/app/api/ideas/route';

let dir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ideas-route-'));
  process.env.FOUNDER_OS_DB = path.join(dir, 'test.db');
});
afterAll(() => {
  delete process.env.FOUNDER_OS_DB;
  fs.rmSync(dir, { recursive: true, force: true });
});

const post = (body: unknown) => POST(new Request('http://x/api/ideas', { method: 'POST', body: JSON.stringify(body) }));

describe('POST /api/ideas', () => {
  it('creates an idea, computes its score, defaults status to new', async () => {
    const res = await post({ title: 'Weekly grade digest', marketSize: 4, effort: 2, strategicFit: 5 });
    expect(res.status).toBe(201);
    const { idea, score } = (await res.json()) as { idea: Record<string, unknown>; score: number };
    expect(idea.id).toBeTruthy();
    expect(idea.status).toBe('new');
    expect(score).toBeCloseTo(4 * 0.4 + 2 * 0.3 + 5 * 0.3, 5);
  });

  it('400s when a rating is out of 1..5', async () => {
    const res = await post({ title: 'x', marketSize: 9, effort: 2, strategicFit: 5 });
    expect(res.status).toBe(400);
  });

  it('400s when the title is missing', async () => {
    const res = await post({ marketSize: 4, effort: 2, strategicFit: 5 });
    expect(res.status).toBe(400);
  });

  it('GET lists ideas with their computed score, highest first', async () => {
    await post({ title: 'Low score', marketSize: 1, effort: 1, strategicFit: 1 });
    const body = (await (await GET()).json()) as { ideas: { title: string; score: number }[] };
    expect(body.ideas[0].title).toBe('Weekly grade digest');
    expect(body.ideas[0].score).toBeGreaterThan(body.ideas.at(-1)!.score);
  });
});
