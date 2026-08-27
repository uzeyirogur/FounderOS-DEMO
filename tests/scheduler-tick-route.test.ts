import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { POST, GET } from '@/app/api/scheduler/tick/route';

/**
 * POST /api/scheduler/tick is the external-ticker entry point: today, an
 * out-of-process scheduler (a Hermes cronjob, or `curl` from any cron-capable
 * host) calls this once a minute. Same optional-shared-secret pattern as the
 * ManyChat webhook: if SCHEDULER_TICK_SECRET is set, the request must carry a
 * matching x-scheduler-secret header.
 */
let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sched-tick-'));
  process.env.FOUNDER_OS_DB = path.join(dir, 'test.db');
});

afterEach(() => {
  delete process.env.FOUNDER_OS_DB;
  delete process.env.SCHEDULER_TICK_SECRET;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('POST /api/scheduler/tick', () => {
  it('runs a tick and returns fired/skipped with no secret configured', async () => {
    const res = await POST(new Request('http://x/api/scheduler/tick', { method: 'POST' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { checkedAt: string; fired: string[]; skipped: unknown[] };
    expect(body.fired).toEqual([]);
    expect(body.skipped).toEqual([]);
    expect(typeof body.checkedAt).toBe('string');
  });

  it('401s when a secret is configured and missing', async () => {
    process.env.SCHEDULER_TICK_SECRET = 's3cr3t';
    const res = await POST(new Request('http://x/api/scheduler/tick', { method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('401s when a secret is configured and wrong', async () => {
    process.env.SCHEDULER_TICK_SECRET = 's3cr3t';
    const res = await POST(
      new Request('http://x/api/scheduler/tick', { method: 'POST', headers: { 'x-scheduler-secret': 'wrong' } }),
    );
    expect(res.status).toBe(401);
  });

  it('200s when the secret header matches', async () => {
    process.env.SCHEDULER_TICK_SECRET = 's3cr3t';
    const res = await POST(
      new Request('http://x/api/scheduler/tick', { method: 'POST', headers: { 'x-scheduler-secret': 's3cr3t' } }),
    );
    expect(res.status).toBe(200);
  });
});

describe('GET /api/scheduler/tick', () => {
  it('reports honest configuration status, not a fake connected state', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; enabledCrons: number; secured: boolean; note: string };
    expect(body.ok).toBe(true);
    expect(typeof body.enabledCrons).toBe('number');
    expect(body.secured).toBe(false);
    expect(body.note).toMatch(/external ticker/i);
  });
});
