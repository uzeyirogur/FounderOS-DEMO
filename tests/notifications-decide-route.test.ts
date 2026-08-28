import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { POST as decide } from '@/app/api/notifications/[id]/decide/route';
import { POST as create } from '@/app/api/notifications/route';

let dir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notif-decide-route-'));
  process.env.FOUNDER_OS_DB = path.join(dir, 'test.db');
});
afterAll(() => {
  delete process.env.FOUNDER_OS_DB;
  fs.rmSync(dir, { recursive: true, force: true });
});

async function makeApprovalRequest() {
  const req = new Request('http://x/api/notifications', {
    method: 'POST',
    body: JSON.stringify({
      kind: 'approval_request',
      agentId: 'claude-code-orchestrator',
      title: 'Approve deploying feature/x to production?',
      body: 'All tests green. Deploy now?',
    }),
  });
  const res = await create(req);
  const json = await res.json();
  return json.notification.id as string;
}

describe('POST /api/notifications/[id]/decide', () => {
  it('rejects an unknown decision value', async () => {
    const id = await makeApprovalRequest();
    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ decision: 'maybe', decidedBy: 'whatsapp:+90500000001' }),
    });
    const res = await decide(req, { params: { id } });
    expect(res.status).toBe(400);
  });

  it('rejects a decision missing decidedBy (every decision must be attributable)', async () => {
    const id = await makeApprovalRequest();
    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ decision: 'approved' }),
    });
    const res = await decide(req, { params: { id } });
    expect(res.status).toBe(400);
  });

  it('404s for an unknown notification id', async () => {
    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ decision: 'approved', decidedBy: 'whatsapp:+90500000001' }),
    });
    const res = await decide(req, { params: { id: 'does-not-exist' } });
    expect(res.status).toBe(404);
  });

  it('approves a real approval_request and records who decided', async () => {
    const id = await makeApprovalRequest();
    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ decision: 'approved', decidedBy: 'whatsapp:+90500000001', responseText: 'yes' }),
    });
    const res = await decide(req, { params: { id } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.notification.status).toBe('approved');
    expect(json.notification.decidedBy).toBe('whatsapp:+90500000001');
  });

  it('refuses to decide a daily_report (informational rows cannot be approved)', async () => {
    const req = new Request('http://x/api/notifications', {
      method: 'POST',
      body: JSON.stringify({ kind: 'daily_report', agentId: 'executive-reporter', title: 't', body: 'b' }),
    });
    const created = await (await create(req)).json();
    const decideReq = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ decision: 'approved', decidedBy: 'whatsapp:+90500000001' }),
    });
    const res = await decide(decideReq, { params: { id: created.notification.id } });
    expect(res.status).toBe(422);
  });
});
