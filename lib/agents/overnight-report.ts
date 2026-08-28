/**
 * Executive Reporter's real "overnight report" — the exact shape the
 * operator asked for: completed/failed work, pending approvals,
 * credential-blocked capabilities, and where every registered project
 * sits in its lifecycle. Every field is a real DB query result; nothing
 * here is invented commentary or an LLM guess.
 */
import type { FounderDb } from '@/lib/db';
import type { DelegatedTask, LifecycleApproval, CapabilityProvider } from '@/lib/schemas';
import { buildExecutiveReport, type ExecutiveReport } from '@/lib/agents/executive-report';

export interface OvernightReport {
  generatedAt: string;
  runHealth: ExecutiveReport;
  completedTasks: DelegatedTask[];
  failedTasks: DelegatedTask[];
  pendingApprovals: LifecycleApproval[];
  candidateCapabilities: CapabilityProvider[];
  projectLifecycleStates: { projectId: string; currentPhase: string }[];
  toMarkdown(): string;
}

export function buildOvernightReport(db: FounderDb, opts: { windowHours?: number } = {}): OvernightReport {
  const runHealth = buildExecutiveReport(db, { windowHours: opts.windowHours ?? 24 });

  const allTasks = db.delegatedTasks.all();
  const completedTasks = allTasks.filter((t) => t.status === 'done');
  const failedTasks = allTasks.filter((t) => t.status === 'failed');
  const pendingApprovals = db.lifecycleApprovals.pending();
  const candidateCapabilities = db.capabilities.all().filter((c) => c.status === 'candidate');

  // Every project that has ever had a lifecycle row — reads lifecycleState
  // directly rather than joining through the Project Registry, since a
  // lifecycle row can legitimately outlive a project's registry entry.
  const projectLifecycleStates = db.lifecycleState
    .all()
    .map((s) => ({ projectId: s.projectId, currentPhase: s.currentPhase as string }));

  const report: OvernightReport = {
    generatedAt: new Date().toISOString(),
    runHealth,
    completedTasks,
    failedTasks,
    pendingApprovals,
    candidateCapabilities,
    projectLifecycleStates,
    toMarkdown(): string {
      const lines: string[] = [];
      lines.push(`# Overnight Report — ${report.generatedAt}`);
      lines.push('');
      lines.push(`## Run health (last ${runHealth.windowHours}h)`);
      lines.push(runHealth.summary);
      lines.push('');
      lines.push('## Completed');
      lines.push(
        completedTasks.length === 0
          ? 'none'
          : completedTasks.map((t) => `- [${t.assignedAgentId}] ${t.goal} — ${t.resultSummary ?? 'done'}`).join('\n'),
      );
      lines.push('');
      lines.push('## Failed');
      lines.push(
        failedTasks.length === 0
          ? 'none'
          : failedTasks.map((t) => `- [${t.assignedAgentId}] ${t.goal} — ${t.failureReason ?? 'unknown failure'}`).join('\n'),
      );
      lines.push('');
      lines.push('## Pending approvals');
      lines.push(
        pendingApprovals.length === 0 ? 'none' : pendingApprovals.map((a) => `- ${a.title} (project ${a.projectId}, phase ${a.phase})`).join('\n'),
      );
      lines.push('');
      lines.push('## Capabilities awaiting credential/approval');
      lines.push(
        candidateCapabilities.length === 0
          ? 'none'
          : candidateCapabilities.map((c) => `- ${c.name} (${c.capability}) — ${c.authRequired ? 'needs credential' : 'no credential needed'}, cost: ${c.costModel}`).join('\n'),
      );
      lines.push('');
      lines.push('## Project lifecycle states');
      lines.push(
        projectLifecycleStates.length === 0
          ? 'none registered'
          : projectLifecycleStates.map((s) => `- ${s.projectId}: ${s.currentPhase}`).join('\n'),
      );
      return lines.join('\n');
    },
  };
  return report;
}
