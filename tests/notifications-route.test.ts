import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { POST as create, GET as list } from '@/app/api/notifications/route';

let dir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notif-route-'));
  process.env.FOUNDER_OS_DB = path.join(dir, 'test.db');
});
afterAll(() => {
  delete process.env.FOUNDER_OS_DB;
  fs.rmSync(dir, { recursive: true, force: true });
});

/** Basic route contract test — mirrors tests/idea-lab-route.test.ts. */
describe('POST /api/notifications', () => {
  it('rejects a payload missing required fields', async () => {
    const req = new Request('http://x/api/notifications', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await create(req);
    expect(res.status).toBe(400);
  });

  it('creates a notification with requiresApproval defaulting false for daily_report', async () => {
    const req = new Request('http://x/api/notifications', {
      method: 'POST',
      body: JSON.stringify({
        kind: 'daily_report',
        agentId: 'executive-reporter',
        title: 'Daily digest',
        body: 'summary text',
      }),
    });
    const res = await create(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.notification.requiresApproval).toBe(false);
    expect(json.notification.status).toBe('pending');
  });
});

describe('GET /api/notifications', () => {
  it('returns an object with a notifications array', async () => {
    const res = await list();
    const json = await res.json();
    expect(Array.isArray(json.notifications)).toBe(true);
  });
});
