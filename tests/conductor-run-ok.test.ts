import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * Found live tonight (Agent Reality Audit run): the conductor agent's
 * run() tied its own ok to localStackStatus() — an unrelated local dev
 * tool inventory (remotion/ollama/ffmpeg/etc, most of which are never
 * configured on a given machine). A conductor run that successfully did
 * its actual job (aggregating real cross-system blocker counts) was
 * reported as "failed" whenever ANY of ~9 optional local tools was down —
 * which is close to always. This is the exact same bug class as the
 * executive-reporter self-feeding-failure-loop fix from the prior
 * session: ok must reflect whether THIS agent's own job succeeded, not
 * unrelated infrastructure data it happens to report alongside it.
 */
describe('conductor agent run() — ok reflects its own job, not unrelated local-stack status', () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'conductor-run-ok-'));
    process.env.FOUNDER_OS_DB = path.join(dir, 'test.db');
  });
  afterAll(() => {
    delete process.env.FOUNDER_OS_DB;
    rmSync(dir, { recursive: true, force: true });
  });

  it('reports ok:true even when every local-stack host is down, as long as status aggregation itself succeeded', async () => {
    const { realAgents } = await import('@/lib/agents/real');
    const conductor = realAgents.find((a) => a.id === 'conductor')!;
    const result = await conductor.run();
    // On a fresh machine with none of the optional local dev tools running,
    // localStackStatus() legitimately reports 0/N connected — that is real,
    // honest data about the environment, not a conductor failure.
    expect(result.ok).toBe(true);
    expect(result.summary).toMatch(/all clear|item\(s\) waiting/i);
  });
});
