import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GET as listMessages } from '@/app/api/outbound-messages/route';
import { POST as draft } from '@/app/api/outbound-messages/draft/route';
import { POST as decide } from '@/app/api/outbound-messages/[id]/decide/route';
import { POST as send } from '@/app/api/outbound-messages/[id]/send/route';

let dir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'outbound-route-'));
  process.env.FOUNDER_OS_DB = path.join(dir, 'test.db');
});
afterAll(() => {
  delete process.env.FOUNDER_OS_DB;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('GET /api/outbound-messages', () => {
  it('starts empty', async () => {
    const body = await (await listMessages()).json();
    expect(body.messages).toEqual([]);
  });
});

describe('POST /api/outbound-messages/draft', () => {
  it('drafts a message at pending_approval', async () => {
    const res = await draft(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ channel: 'email', to: 'a@b.com', subject: 'Hi', body: 'hello' }) }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.message.status).toBe('pending_approval');
  });
});

describe('outbound message approval + send end-to-end', () => {
  it('refuses to send before approval, then honestly fails on whatsapp (no real connector wired)', async () => {
    const draftRes = await draft(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ channel: 'whatsapp', to: '+15555550100', body: 'hi' }) }),
    );
    const { message } = await draftRes.json();

    const blocked = await send(new Request('http://x', { method: 'POST' }), { params: { id: message.id } });
    const blockedBody = await blocked.json();
    expect(blockedBody.result.ok).toBe(false);
    expect(blockedBody.result.reason).toMatch(/not approved/i);

    const decideRes = await decide(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ decision: 'approved', decidedBy: 'local-ui' }) }),
      { params: { id: message.id } },
    );
    expect(decideRes.status).toBe(200);

    const attempt = await send(new Request('http://x', { method: 'POST' }), { params: { id: message.id } });
    const attemptBody = await attempt.json();
    expect(attemptBody.result.ok).toBe(false);
    expect(attemptBody.result.reason).toMatch(/no real whatsapp send connector/i);
    expect(attemptBody.message.status).toBe('failed');
  });

  it('404s deciding an unknown message', async () => {
    const res = await decide(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ decision: 'approved', decidedBy: 'x' }) }),
      { params: { id: 'nope' } },
    );
    expect(res.status).toBe(404);
  });
});
