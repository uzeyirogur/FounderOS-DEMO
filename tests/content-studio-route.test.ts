import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GET as listPieces } from '@/app/api/content-pieces/route';
import { POST as produce } from '@/app/api/content-pieces/produce/route';

vi.mock('@/lib/connectors/llm', () => ({
  chat: vi.fn().mockResolvedValue({ text: 'A great social post!', toolCalls: [] }),
}));

let dir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'content-pieces-route-'));
  process.env.FOUNDER_OS_DB = path.join(dir, 'test.db');
});
afterAll(() => {
  delete process.env.FOUNDER_OS_DB;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('GET /api/content-pieces', () => {
  it('starts empty', async () => {
    const body = await (await listPieces()).json();
    expect(body.pieces).toEqual([]);
  });
});

describe('POST /api/content-pieces/produce', () => {
  it('produces a social_post via the (mocked) LLM gateway', async () => {
    const res = await produce(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ kind: 'social_post', brief: 'Announce v2' }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.piece.status).toBe('produced');
    expect(body.piece.output).toBe('A great social post!');
  });

  it('a media kind with no active capability returns needs_capability (honest, no network call needed since not_configured)', async () => {
    const res = await produce(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ kind: 'product_demo_video', brief: 'Demo the dashboard' }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.piece.status).toBe('needs_capability');
    expect(body.piece.requiredCapability).toBe('video-generation');
  });

  it('400s on an invalid kind', async () => {
    const res = await produce(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ kind: 'not-a-real-kind', brief: 'x' }) }),
    );
    expect(res.status).toBe(400);
  });
});
