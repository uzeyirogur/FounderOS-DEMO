import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getDb } from '@/lib/data';
import { realAgents } from '@/lib/agents/real';

/**
 * Real bug found live tonight (production dev server, seeded data): after
 * a project-agnostic overnight sweep of `/api/overnight-report`, executive-
 * reporter's own agent_runs showed 3 straight failures even though nothing
 * was actually broken — anka-operations had one real health-check blip.
 *
 * Root cause: run() set ok = (report.failedRuns === 0) — Executive
 * Reporter's OWN run was marked failed whenever ANY agent in the 24h
 * window had a failure, including Executive Reporter's own past runs.
 * That is a self-feeding loop: a genuinely successful digest run gets
 * recorded as a failure, which then counts against the next run's
 * failedRuns forever, even after the underlying issue is long gone.
 *
 * Executive Reporter's run() should succeed if IT built the report — the
 * counts inside the report describing OTHER agents' health are DATA, not
 * a verdict on Executive Reporter's own execution.
 */
let dir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exec-reporter-loop-'));
  process.env.FOUNDER_OS_DB = path.join(dir, 'test.db');
});
afterAll(() => {
  delete process.env.FOUNDER_OS_DB;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('executive-reporter run() — no self-feeding failure loop', () => {
  it('is ok:true even when the report it built describes another agent failing', async () => {
    const db = getDb();
    db.agentRuns.insert({
      id: 'r1',
      agentId: 'anka-operations',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      ok: false,
      summary: 'Health check failed',
    });
    const agent = realAgents.find((a) => a.id === 'executive-reporter');
    if (!agent) throw new Error('executive-reporter agent not found');
    const result = await agent.run();
    expect(result.ok).toBe(true);
  });
});
