'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, X } from 'lucide-react';
import { PROJECT_LIFECYCLE_PHASES, type ProjectLifecyclePhase } from '@/lib/project-lifecycle';

const PHASE_LABEL: Record<ProjectLifecyclePhase, string> = {
  idea: 'Idea',
  research: 'Research',
  validation: 'Validation',
  product_planning: 'Product planning',
  technical_planning: 'Technical planning',
  implementation: 'Implementation',
  qa: 'QA',
  security: 'Security',
  ui_ux: 'UI/UX',
  launch_readiness: 'Launch readiness',
  deployment_approval: 'Deployment approval',
  growth: 'Growth',
  social: 'Social',
  monitoring: 'Monitoring',
  iteration: 'Iteration',
  reporting: 'Reporting',
};

interface LifecycleSummary {
  projectId: string;
  currentPhase: ProjectLifecyclePhase;
  responsibleAgentId: string;
  openTasks: { id: string; title: string; status: string; blockedReason: string | null }[];
  pendingApprovals: { id: string; title: string; description: string }[];
  updatedAt: string;
}

/**
 * Live phase tracker for a single Project Registry entry: a 16-step rail
 * (idea -> ... -> reporting), who is responsible for the current phase, its
 * open tasks, and any approval gate blocking it — with an inline
 * approve/reject when a gate (e.g. deployment_approval) is waiting.
 */
export function ProjectLifecycleWidget({
  projectId,
  agentNames,
  initial,
}: {
  projectId: string;
  agentNames: Record<string, string>;
  initial: LifecycleSummary;
}) {
  const router = useRouter();
  const [summary, setSummary] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/lifecycle`);
    if (res.ok) setSummary(await res.json());
  };

  const advance = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/lifecycle/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestedByAgentId: 'local-ui' }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Could not advance the phase.');
        if (body.state) setSummary((s) => ({ ...s, currentPhase: body.state.currentPhase }));
        return;
      }
      await refresh();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const decide = async (approvalId: string, decision: 'approved' | 'rejected') => {
    setBusy(true);
    try {
      await fetch(`/api/lifecycle-approvals/${encodeURIComponent(approvalId)}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, decidedBy: 'local-ui' }),
      });
      await refresh();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const currentIndex = PROJECT_LIFECYCLE_PHASES.indexOf(summary.currentPhase);

  return (
    <div className="rounded-lg-t border border-os-border bg-os-surface p-4">
      <div className="mb-3 flex flex-wrap items-center gap-1">
        {PROJECT_LIFECYCLE_PHASES.map((phase, i) => (
          <span
            key={phase}
            title={PHASE_LABEL[phase]}
            className={`rounded-sm-t border px-2 py-1 font-mono text-[9.5px] uppercase tracking-[0.08em] ${
              i < currentIndex
                ? 'border-os-border bg-os-bg text-os-dim line-through'
                : i === currentIndex
                  ? 'border-os-accent bg-os-accent/10 text-os-accent'
                  : 'border-os-border bg-os-bg text-os-muted'
            }`}
          >
            {PHASE_LABEL[phase]}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-os-border pt-3">
        <div className="text-[11.5px] text-os-muted">
          Responsible: <span className="text-os-text">{agentNames[summary.responsibleAgentId] ?? summary.responsibleAgentId}</span>
        </div>
        <button
          onClick={advance}
          disabled={busy || summary.pendingApprovals.length > 0}
          className="inline-flex items-center gap-1.5 rounded-sm-t border border-os-border bg-os-bg px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-os-text transition-colors hover:border-os-border-strong disabled:opacity-40"
        >
          Advance phase <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {error && <p className="mt-2 font-mono text-[10.5px] text-os-err">{error}</p>}

      {summary.pendingApprovals.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-os-border pt-3">
          {summary.pendingApprovals.map((a) => (
            <div key={a.id} className="rounded-sm-t border border-os-warn/40 bg-os-warn/5 px-3 py-2">
              <div className="text-[12px] font-semibold text-os-text">{a.title}</div>
              {a.description && <div className="mt-0.5 text-[11px] text-os-muted">{a.description}</div>}
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => decide(a.id, 'approved')}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-sm-t border border-os-ok/50 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-os-ok disabled:opacity-40"
                >
                  <Check className="h-3 w-3" /> Approve
                </button>
                <button
                  onClick={() => decide(a.id, 'rejected')}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-sm-t border border-os-err/50 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-os-err disabled:opacity-40"
                >
                  <X className="h-3 w-3" /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {summary.openTasks.length > 0 && (
        <div className="mt-3 border-t border-os-border pt-3">
          <div className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-os-dim">Open tasks</div>
          <ul className="space-y-1">
            {summary.openTasks.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-[11.5px] text-os-muted">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.status === 'blocked' ? 'bg-os-err' : t.status === 'doing' ? 'bg-os-warn' : 'bg-os-dim'}`}
                />
                {t.title}
                {t.status === 'blocked' && t.blockedReason && (
                  <span className="text-os-err">— {t.blockedReason}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
