import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GET as getStatus } from '@/app/api/conductor/status/route';

let dir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conductor-route-'));
  process.env.FOUNDER_OS_DB = path.join(dir, 'test.db');
});
afterAll(() => {
  delete process.env.FOUNDER_OS_DB;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('GET /api/conductor/status', () => {
  it('returns the real, live status shape', async () => {
    const res = await getStatus();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toMatchObject({
      pendingLifecycleApprovals: 0,
      pendingPublishPlans: 0,
      pendingOutboundMessages: 0,
      candidateCapabilities: 0,
      blockedContentPieces: 0,
      totalBlockers: 0,
    });
  });
});
