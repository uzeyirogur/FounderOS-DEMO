import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GET as listTasks } from '@/app/api/personal-tasks/route';
import { POST as create } from '@/app/api/personal-tasks/create/route';
import { POST as complete } from '@/app/api/personal-tasks/[id]/complete/route';

let dir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'personal-tasks-route-'));
  process.env.FOUNDER_OS_DB = path.join(dir, 'test.db');
});
afterAll(() => {
  delete process.env.FOUNDER_OS_DB;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('personal tasks route', () => {
  it('starts empty', async () => {
    const body = await (await listTasks()).json();
    expect(body.tasks).toEqual([]);
  });

  it('creates a task at open status', async () => {
    const res = await create(new Request('http://x', { method: 'POST', body: JSON.stringify({ title: 'Call the accountant' }) }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.task.status).toBe('open');
    expect(body.task.priority).toBe('normal');
  });

  it('completes a task', async () => {
    const createRes = await create(new Request('http://x', { method: 'POST', body: JSON.stringify({ title: 'x', priority: 'high' }) }));
    const { task } = await createRes.json();
    const res = await complete(new Request('http://x', { method: 'POST' }), { params: { id: task.id } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.task.status).toBe('done');
  });

  it('404s completing an unknown task', async () => {
    const res = await complete(new Request('http://x', { method: 'POST' }), { params: { id: 'nope' } });
    expect(res.status).toBe(404);
  });
});
