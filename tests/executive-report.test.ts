import { describe, it, expect, afterEach } from 'vitest';
import { openDb, type FounderDb } from '@/lib/db';
import { buildExecutiveReport } from '@/lib/agents/executive-report';

/**
 * Executive Reporter turns raw agent_runs + broadcasts into a plain-language
 * daily/weekly digest. No LLM call required for the base report (it works
 * offline, deterministic, testable) — a summary of counts and failures is
 * always available; richer prose can layer on top later via the LLM gateway.
 */
let db: FounderDb;

afterEach(() => db?.close());

describe('buildExecutiveReport', () => {
  it('reports zero runs honestly when nothing has happened', () => {
    db = openDb(':memory:');
    const report = buildExecutiveReport(db, { windowHours: 24, now: new Date('2026-08-27T12:00:00Z') });
    expect(report.totalRuns).toBe(0);
    expect(report.okRuns).toBe(0);
    expect(report.failedRuns).toBe(0);
    expect(report.byAgent).toEqual([]);
    expect(report.summary).toMatch(/no agent runs/i);
  });

  it('counts ok vs failed runs inside the window, grouped by agent', () => {
    db = openDb(':memory:');
    const now = new Date('2026-08-27T12:00:00Z');
    db.agentRuns.insert({ id: 'r1', agentId: 'gmail-worker', startedAt: '2026-08-27T10:00:00Z', finishedAt: '2026-08-27T10:00:01Z', ok: true, summary: 'ok' });
    db.agentRuns.insert({ id: 'r2', agentId: 'gmail-worker', startedAt: '2026-08-27T11:00:00Z', finishedAt: '2026-08-27T11:00:01Z', ok: false, summary: 'IMAP timeout' });
    db.agentRuns.insert({ id: 'r3', agentId: 'stack-monitor', startedAt: '2026-08-27T09:00:00Z', finishedAt: '2026-08-27T09:00:01Z', ok: true, summary: 'ok' });
    const report = buildExecutiveReport(db, { windowHours: 24, now });
    expect(report.totalRuns).toBe(3);
    expect(report.okRuns).toBe(2);
    expect(report.failedRuns).toBe(1);
    const gmail = report.byAgent.find((a) => a.agentId === 'gmail-worker');
    expect(gmail).toMatchObject({ ok: 1, failed: 1 });
  });

  it('excludes runs outside the requested window', () => {
    db = openDb(':memory:');
    const now = new Date('2026-08-27T12:00:00Z');
    db.agentRuns.insert({ id: 'old', agentId: 'gmail-worker', startedAt: '2026-08-20T00:00:00Z', finishedAt: '2026-08-20T00:00:01Z', ok: true, summary: 'stale' });
    const report = buildExecutiveReport(db, { windowHours: 24, now });
    expect(report.totalRuns).toBe(0);
  });

  it('surfaces the most recent failures with their summary text', () => {
    db = openDb(':memory:');
    const now = new Date('2026-08-27T12:00:00Z');
    db.agentRuns.insert({ id: 'r1', agentId: 'gmail-worker', startedAt: '2026-08-27T10:00:00Z', finishedAt: '2026-08-27T10:00:01Z', ok: false, summary: 'IMAP timeout' });
    const report = buildExecutiveReport(db, { windowHours: 24, now });
    expect(report.recentFailures).toHaveLength(1);
    expect(report.recentFailures[0]).toMatchObject({ agentId: 'gmail-worker', summary: 'IMAP timeout' });
  });

  it('a human-readable summary line mentions the totals', () => {
    db = openDb(':memory:');
    const now = new Date('2026-08-27T12:00:00Z');
    db.agentRuns.insert({ id: 'r1', agentId: 'gmail-worker', startedAt: '2026-08-27T10:00:00Z', finishedAt: '2026-08-27T10:00:01Z', ok: true, summary: 'ok' });
    const report = buildExecutiveReport(db, { windowHours: 24, now });
    expect(report.summary).toContain('1');
  });
});
