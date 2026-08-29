import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GET as listTasks, POST as createTask } from '@/app/api/conductor/tasks/route';
import { PATCH as patchTask } from '@/app/api/conductor/tasks/[id]/route';

let dir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conductor-tasks-route-'));
  process.env.FOUNDER_OS_DB = path.join(dir, 'test.db');
});
afterAll(() => {
  delete process.env.FOUNDER_OS_DB;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('GET /api/conductor/tasks', () => {
  it('starts empty', async () => {
    const body = await (await listTasks(new Request('http://x'))).json();
    expect(body.tasks).toEqual([]);
  });
});

describe('POST /api/conductor/tasks', () => {
  it('delegates a task, classifying the agent from the goal', async () => {
    const res = await createTask(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ projectId: 'proj-1', goal: 'Run typecheck and tests before merge' }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.task.assignedAgentId).toBe('qa-ui-review');
    expect(body.task.status).toBe('pending');
  });

  it('400s without a goal', async () => {
    const res = await createTask(new Request('http://x', { method: 'POST', body: JSON.stringify({}) }));
    expect(res.status).toBe(400);
  });

  it('400s on an explicit assignedAgentId that is not a real runtime agent — the route enforces the roster gate, not just the lib function', async () => {
    const res = await createTask(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ goal: 'do something', assignedAgentId: 'totally-made-up-agent' }),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not a real runtime agent/i);
  });
});

describe('PATCH /api/conductor/tasks/[id]', () => {
  it('transitions a task through start -> complete', async () => {
    const created = await (
      await createTask(new Request('http://x', { method: 'POST', body: JSON.stringify({ projectId: 'proj-2', goal: 'Scan for leaked secrets' }) }))
    ).json();
    const id = created.task.id;

    const started = await (
      await patchTask(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ action: 'start' }) }), { params: Promise.resolve({ id }) })
    ).json();
    expect(started.task.status).toBe('in_progress');

    const completed = await (
      await patchTask(
        new Request('http://x', { method: 'PATCH', body: JSON.stringify({ action: 'complete', resultSummary: 'no secrets found' }) }),
        { params: Promise.resolve({ id }) },
      )
    ).json();
    expect(completed.task.status).toBe('done');
    expect(completed.task.resultSummary).toBe('no secrets found');
  });

  it('404s on an unknown task id', async () => {
    const res = await patchTask(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ action: 'start' }) }), {
      params: Promise.resolve({ id: 'nope' }),
    });
    expect(res.status).toBe(404);
  });
});
