import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GET as overnightReport } from '@/app/api/overnight-report/route';

let dir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'overnight-report-route-'));
  process.env.FOUNDER_OS_DB = path.join(dir, 'test.db');
});
afterAll(() => {
  delete process.env.FOUNDER_OS_DB;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('GET /api/overnight-report', () => {
  it('returns real structured JSON by default', async () => {
    const res = await overnightReport(new Request('http://x'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.report).toHaveProperty('completedTasks');
    expect(body.report).toHaveProperty('runHealth');
  });

  it('returns real markdown with ?format=markdown', async () => {
    const res = await overnightReport(new Request('http://x?format=markdown'));
    const text = await res.text();
    expect(text).toContain('# Overnight Report');
  });
});
