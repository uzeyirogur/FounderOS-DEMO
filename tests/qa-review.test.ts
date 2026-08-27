import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseVitestJsonSummary, parseTypecheckOutput } from '@/lib/qa-review';

/**
 * QA & UI/UX Review: parses REAL tool output (vitest --reporter=json,
 * tsc --noEmit stderr) rather than re-implementing test logic. Never invents
 * a pass/fail — if the output does not parse, it reports that honestly.
 */
describe('parseVitestJsonSummary', () => {
  it('extracts pass/fail counts from a vitest JSON reporter summary', () => {
    const json = JSON.stringify({
      numTotalTests: 993,
      numPassedTests: 992,
      numFailedTests: 1,
      testResults: [{ name: 'tests/x.test.ts', status: 'failed' }],
    });
    const summary = parseVitestJsonSummary(json);
    expect(summary).toEqual({ total: 993, passed: 992, failed: 1, failedFiles: ['tests/x.test.ts'] });
  });

  it('returns null for output that is not valid vitest JSON', () => {
    expect(parseVitestJsonSummary('not json at all')).toBeNull();
    expect(parseVitestJsonSummary('{}')).toBeNull();
  });
});

describe('parseTypecheckOutput', () => {
  it('counts TS error lines from tsc --noEmit output', () => {
    const output = [
      'lib/db.ts(14,3): error TS2305: Module has no exported member.',
      'lib/db.ts(47,8): error TS2305: Module has no exported member.',
    ].join('\n');
    expect(parseTypecheckOutput(output)).toEqual({ errorCount: 2, ok: false });
  });

  it('reports ok:true for clean output with no error lines', () => {
    expect(parseTypecheckOutput('')).toEqual({ errorCount: 0, ok: true });
  });
});
