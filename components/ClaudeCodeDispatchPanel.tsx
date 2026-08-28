'use client';

import { useState } from 'react';
import { Terminal } from 'lucide-react';

/** Claude Code Orchestrator's real dispatch panel for a single project.
 *  This is a PAID operation against the operator's real claude account —
 *  the confirm step is a deliberate speed bump, not a fake one. */
export function ClaudeCodeDispatchPanel({ projectId, authorized }: { projectId: string; authorized: boolean }) {
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

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

  const dispatch = async () => {
    if (!prompt.trim() || !confirmed) return;
    setBusy(true);
    setError(null);
    setOutput(null);
    try {
      const res = await fetch('/api/claude-code/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, prompt }),
      });
      const body = await res.json();
      if (res.ok && body.result?.ok) {
        setOutput(body.result.result);
        setPrompt('');
        setConfirmed(false);
      } else {
        setError(body.result?.reason ?? body.error ?? 'Dispatch failed.');
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
        Dispatches to the real `claude` CLI — a paid API call. Never pushes, force-pushes, or merges.
      </p>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe the coding task…"
        rows={3}
        className="w-full rounded-sm-t border border-os-border bg-os-bg px-2 py-1.5 text-[12px] text-os-text outline-none focus:border-os-border-strong"
      />
      <label className="mt-2 flex items-center gap-1.5 text-[11px] text-os-muted">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        I understand this is a real, paid claude call
      </label>
      <button
        onClick={dispatch}
        disabled={busy || !prompt.trim() || !confirmed}
        className="mt-2 inline-flex items-center gap-1.5 rounded-sm-t border border-os-border bg-os-bg px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-os-text transition-colors hover:border-os-border-strong disabled:opacity-40"
      >
        Dispatch
      </button>
      {error && <p className="mt-2 font-mono text-[10.5px] text-os-err">{error}</p>}
      {output && (
        <div className="mt-3 whitespace-pre-wrap rounded-sm-t border border-os-border bg-os-bg px-3 py-2 text-[12px] leading-relaxed text-os-text">
          {output}
        </div>
      )}
    </div>
  );
}
