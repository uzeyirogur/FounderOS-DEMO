import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GET as listPlans } from '@/app/api/publish-plans/route';
import { POST as draft } from '@/app/api/publish-plans/draft/route';
import { POST as decide } from '@/app/api/publish-plans/[id]/decide/route';
import { POST as publish } from '@/app/api/publish-plans/[id]/publish/route';

let dir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-route-'));
  process.env.FOUNDER_OS_DB = path.join(dir, 'test.db');
});
afterAll(() => {
  delete process.env.FOUNDER_OS_DB;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('GET /api/publish-plans', () => {
  it('starts empty', async () => {
    const body = await (await listPlans()).json();
    expect(body.plans).toEqual([]);
  });
});

describe('POST /api/publish-plans/draft', () => {
  it('drafts a plan at pending_approval', async () => {
    const res = await draft(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ contentPieceId: 'c1', platforms: ['instagram'], caption: 'x' }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.plan.status).toBe('pending_approval');
  });
});

describe('publish plan approval + publish attempt end-to-end', () => {
  it('refuses to publish before approval, then honestly fails after (no real connector wired)', async () => {
    const draftRes = await draft(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ contentPieceId: 'c2', platforms: ['linkedin'], caption: 'y' }) }),
    );
    const { plan } = await draftRes.json();

    const blocked = await publish(new Request('http://x', { method: 'POST' }), { params: { id: plan.id } });
    const blockedBody = await blocked.json();
    expect(blockedBody.result.ok).toBe(false);
    expect(blockedBody.result.reason).toMatch(/not approved/i);

    const decideRes = await decide(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ decision: 'approved', decidedBy: 'local-ui' }) }),
      { params: { id: plan.id } },
    );
    expect(decideRes.status).toBe(200);

    const attempt = await publish(new Request('http://x', { method: 'POST' }), { params: { id: plan.id } });
    const attemptBody = await attempt.json();
    expect(attemptBody.result.ok).toBe(false);
    expect(attemptBody.result.reason).toMatch(/no real publish connector/i);
    expect(attemptBody.plan.status).toBe('failed');
  });

  it('404s deciding an unknown plan', async () => {
    const res = await decide(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ decision: 'approved', decidedBy: 'x' }) }),
      { params: { id: 'nope' } },
    );
    expect(res.status).toBe(404);
  });
});
