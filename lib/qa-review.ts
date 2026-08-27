/**
 * QA & UI/UX Review: parses REAL tool output — this repo's own `npm test`
 * (vitest --reporter=json) and `npm run typecheck` (tsc --noEmit) — never a
 * separate re-implementation of test logic. If output does not parse as
 * expected, that is reported honestly (null / ok:false) rather than guessed.
 */
export type VitestSummary = { total: number; passed: number; failed: number; failedFiles: string[] };

export function parseVitestJsonSummary(raw: string): VitestSummary | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const body = parsed as {
    numTotalTests?: unknown;
    numPassedTests?: unknown;
    numFailedTests?: unknown;
    testResults?: unknown;
  };
  if (
    typeof body.numTotalTests !== 'number' ||
    typeof body.numPassedTests !== 'number' ||
    typeof body.numFailedTests !== 'number'
  ) {
    return null;
  }
  const results = Array.isArray(body.testResults) ? body.testResults : [];
  const failedFiles = results
    .filter((r): r is { name: string; status: string } => {
      const row = r as Record<string, unknown>;
      return typeof row.name === 'string' && row.status === 'failed';
    })
    .map((r) => r.name);
  return { total: body.numTotalTests, passed: body.numPassedTests, failed: body.numFailedTests, failedFiles };
}

export type TypecheckSummary = { errorCount: number; ok: boolean };

const TS_ERROR_LINE = /error TS\d+:/;

export function parseTypecheckOutput(output: string): TypecheckSummary {
  const errorCount = output.split('\n').filter((line) => TS_ERROR_LINE.test(line)).length;
  return { errorCount, ok: errorCount === 0 };
}
