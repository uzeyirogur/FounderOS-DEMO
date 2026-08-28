import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GET as listRoutines } from '@/app/api/routines/route';
import { POST as create } from '@/app/api/routines/create/route';
import { POST as checkIn } from '@/app/api/routines/[id]/check-in/route';

let dir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'routines-route-'));
  process.env.FOUNDER_OS_DB = path.join(dir, 'test.db');
});
afterAll(() => {
  delete process.env.FOUNDER_OS_DB;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('routines route', () => {
  it('starts empty', async () => {
    const body = await (await listRoutines()).json();
    expect(body.routines).toEqual([]);
  });

  it('creates a routine', async () => {
    const res = await create(new Request('http://x', { method: 'POST', body: JSON.stringify({ title: 'Morning walk', frequency: 'daily' }) }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.routine.active).toBe(true);
  });

  it('checks in and reports streak 1, then checking in again same day stays 1', async () => {
    const createRes = await create(new Request('http://x', { method: 'POST', body: JSON.stringify({ title: 'x', frequency: 'daily' }) }));
    const { routine } = await createRes.json();

    const first = await checkIn(new Request('http://x', { method: 'POST' }), { params: { id: routine.id } });
    expect((await first.json()).streak).toBe(1);

    const second = await checkIn(new Request('http://x', { method: 'POST' }), { params: { id: routine.id } });
    expect((await second.json()).streak).toBe(1); // idempotent — same day, no double count
  });

  it('404s checking in to an unknown routine', async () => {
    const res = await checkIn(new Request('http://x', { method: 'POST' }), { params: { id: 'nope' } });
    expect(res.status).toBe(404);
  });
});
