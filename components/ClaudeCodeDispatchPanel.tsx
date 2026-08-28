'use client';

import { useState } from 'react';
import { Terminal } from 'lucide-react';

/** Claude Code Orchestrator's real dispatch panel for a single project.
 *  Two-step by design: "Queue" only ever builds a real prompt and creates
 *  a ClaudeCodeRun row (free) — it never spends money. "Run for real" on a
 *  queued run is the ONE action that calls the actual `claude` CLI against
 *  the operator's account, and it needs its own explicit click plus the
 *  confirm checkbox — a deliberate speed bump, not a fake one. A
 *  full_with_approval-tier project queues as awaiting_approval and needs
 *  an extra Approve click before it can be run. */
export function ClaudeCodeDispatchPanel({ projectId, authorized }: { projectId: string; authorized: boolean }) {
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [run, setRun] = useState<{ id: string; status: string; prompt: string; resultSummary?: string | null } | null>(null);

  if (!authorized) {
    return (
      <div className="rounded-lg-t border border-os-border bg-os-surface p-4">
        <div className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-os-dim">Claude Code Orchestrator</div>
        <p className="text-[12px] text-os-muted">
          Not authorized on this project. Grant claude-code-orchestrator access above to enable real dispatch.
        </p>
      </div>
    );
  }

  const queue = async () => {
    if (!goal.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/claude-code/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, goal }),
      });
      const body = await res.json();
      if (res.ok) {
        setRun(body.run);
        setGoal('');
      } else {
        setError(body.error ?? 'Failed to queue the run.');
      }
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    if (!run) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/claude-code/runs/${run.id}/approve`, { method: 'POST' });
      const body = await res.json();
      if (res.ok) setRun(body.run);
      else setError(body.error ?? 'Failed to approve.');
    } finally {
      setBusy(false);
    }
  };

  const execute = async () => {
    if (!run || !confirmed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/claude-code/runs/${run.id}/execute`, { method: 'POST' });
      const body = await res.json();
      if (res.ok) {
        setRun(body.run);
        setConfirmed(false);
      } else {
        setError(body.error ?? 'Execution failed.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg-t border border-os-border bg-os-surface p-4">
      <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-os-dim">
        <Terminal className="h-3 w-3" /> Claude Code Orchestrator
      </div>
      <p className="mb-2 text-[11px] text-os-dim">
        Queuing builds a real prompt and is free. Running it dispatches to the real `claude` CLI — a paid API call.
        Never pushes, force-pushes, or merges.
      </p>

      {!run && (
        <>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Describe the coding task…"
            rows={3}
            className="w-full rounded-sm-t border border-os-border bg-os-bg px-2 py-1.5 text-[12px] text-os-text outline-none focus:border-os-border-strong"
          />
          <button
            onClick={queue}
            disabled={busy || !goal.trim()}
            className="mt-2 inline-flex items-center gap-1.5 rounded-sm-t border border-os-border bg-os-bg px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-os-text transition-colors hover:border-os-border-strong disabled:opacity-40"
          >
            Queue (free)
          </button>
        </>
      )}

      {run && (
        <div className="mt-1">
          <div className="whitespace-pre-wrap rounded-sm-t border border-os-border bg-os-bg px-3 py-2 text-[11px] leading-relaxed text-os-muted">
            {run.prompt}
          </div>
          <div className="mt-2 font-mono text-[10.5px] uppercase tracking-widest text-os-accent">Status: {run.status}</div>

          {run.status === 'awaiting_approval' && (
            <button
              onClick={approve}
              disabled={busy}
              className="mt-2 inline-flex items-center gap-1.5 rounded-sm-t border border-os-border bg-os-bg px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-os-text transition-colors hover:border-os-border-strong disabled:opacity-40"
            >
              Approve
            </button>
          )}

          {run.status === 'queued' && (
            <>
              <label className="mt-2 flex items-center gap-1.5 text-[11px] text-os-muted">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                I understand this is a real, paid claude call
              </label>
              <button
                onClick={execute}
                disabled={busy || !confirmed}
                className="mt-2 inline-flex items-center gap-1.5 rounded-sm-t border border-os-border bg-os-bg px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-os-text transition-colors hover:border-os-border-strong disabled:opacity-40"
              >
                Run for real
              </button>
            </>
          )}

          {(run.status === 'done' || run.status === 'failed') && (
            <button
              onClick={() => setRun(null)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-sm-t border border-os-border bg-os-bg px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-os-text transition-colors hover:border-os-border-strong"
            >
              Queue another
            </button>
          )}

          {run.resultSummary && (
            <div className="mt-3 whitespace-pre-wrap rounded-sm-t border border-os-border bg-os-bg px-3 py-2 text-[12px] leading-relaxed text-os-text">
              {run.resultSummary}
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-2 font-mono text-[10.5px] text-os-err">{error}</p>}
    </div>
  );
}
