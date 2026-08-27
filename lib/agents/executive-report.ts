/**
 * Executive Reporter: turns raw agent_runs into a plain-language digest the
 * operator can actually read, instead of scrolling the activity feed.
 * Deterministic and LLM-free by design — a count of runs/failures per agent
 * is always available offline, so the report never degrades to "not
 * configured" just because no AI_GATEWAY_API_KEY is set. Once the Vercel AI
 * Gateway is wired (lib/connectors/llm.ts), a later pass can turn this
 * structured digest into prose; the shape here is what that prose would be
 * grounded in — no invented commentary.
 */
import type { FounderDb } from '@/lib/db';

export type ExecutiveReportAgentRow = { agentId: string; ok: number; failed: number };
export type ExecutiveReportFailure = { agentId: string; at: string; summary: string };

export type ExecutiveReport = {
  windowHours: number;
  generatedAt: string;
  totalRuns: number;
  okRuns: number;
  failedRuns: number;
  byAgent: ExecutiveReportAgentRow[];
  recentFailures: ExecutiveReportFailure[];
  summary: string;
};

export function buildExecutiveReport(
  db: FounderDb,
  opts: { windowHours?: number; now?: Date; maxFailures?: number } = {},
): ExecutiveReport {
  const windowHours = opts.windowHours ?? 24;
  const now = opts.now ?? new Date();
  const maxFailures = opts.maxFailures ?? 10;
  const cutoff = now.getTime() - windowHours * 60 * 60 * 1000;

  // agentRuns.recent has no built-in time filter, so pull a generous batch
  // and filter here. 2000 covers weeks of activity at this app's scale.
  const runs = db.agentRuns.recent(2000).filter((r) => Date.parse(r.startedAt) >= cutoff);

  const byAgentMap = new Map<string, ExecutiveReportAgentRow>();
  for (const r of runs) {
    const row = byAgentMap.get(r.agentId) ?? { agentId: r.agentId, ok: 0, failed: 0 };
    if (r.ok) row.ok += 1;
    else row.failed += 1;
    byAgentMap.set(r.agentId, row);
  }
  const byAgent = [...byAgentMap.values()].sort((a, b) => b.failed - a.failed || a.agentId.localeCompare(b.agentId));

  const failedRuns = runs.filter((r) => !r.ok);
  const recentFailures: ExecutiveReportFailure[] = failedRuns
    .slice()
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
    .slice(0, maxFailures)
    .map((r) => ({ agentId: r.agentId, at: r.startedAt, summary: r.summary }));

  const okRuns = runs.length - failedRuns.length;
  const summary =
    runs.length === 0
      ? `No agent runs in the last ${windowHours}h.`
      : `${runs.length} run${runs.length === 1 ? '' : 's'} in the last ${windowHours}h across ${byAgent.length} agent${
          byAgent.length === 1 ? '' : 's'
        } — ${okRuns} ok, ${failedRuns.length} failed.`;

  return {
    windowHours,
    generatedAt: now.toISOString(),
    totalRuns: runs.length,
    okRuns,
    failedRuns: failedRuns.length,
    byAgent,
    recentFailures,
    summary,
  };
}
