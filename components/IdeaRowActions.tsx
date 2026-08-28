'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Rocket, X } from 'lucide-react';
import type { Idea, IdeaStatus, ProjectKind } from '@/lib/schemas';

const STATUSES: IdeaStatus[] = ['new', 'researching', 'scored', 'shipped', 'archived'];

/**
 * Per-idea controls: status change, promote-to-project (the idea -> project
 * seam of the standard lifecycle), and delete. An idea already linked to a
 * project shows that link instead of the promote form — promotion happens
 * once.
 */
export function IdeaRowActions({ idea }: { idea: Idea }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: idea.title, kind: 'local' as ProjectKind, pathOrUrl: '', purpose: idea.description });

  const call = async (init: RequestInit) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/ideas/${encodeURIComponent(idea.id)}`, {
        headers: { 'Content-Type': 'application/json' },
        ...init,
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const submitPromote = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/ideas/${encodeURIComponent(idea.id)}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: unknown };
        setError(typeof body.error === 'string' ? body.error : 'Check the project name and path/URL.');
        return;
      }
      setPromoting(false);
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (idea.projectId) {
    return (
      <span className="flex items-center gap-2">
        <a
          href="/projects"
          className="inline-flex items-center gap-1 rounded-sm-t border border-os-border bg-os-surface2 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-os-ok"
        >
          <Rocket className="h-3 w-3" /> promoted
        </a>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      <select
        aria-label="Status"
        disabled={busy}
        value={idea.status}
        onChange={(e) => call({ method: 'PATCH', body: JSON.stringify({ status: e.target.value }) })}
        className="rounded-sm-t border border-os-border bg-os-bg px-1.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-os-muted outline-none focus:border-os-border-strong disabled:opacity-40"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      {promoting ? (
        <span className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-label="Promote to project">
          <form
            onSubmit={submitPromote}
            className="w-full max-w-[420px] rounded-lg-t border border-os-border bg-os-surface p-4"
          >
            <div className="mb-3 flex items-center">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-os-dim">Promote to project</span>
              <button type="button" onClick={() => setPromoting(false)} aria-label="Close" className="ml-auto text-os-dim hover:text-os-text">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid gap-3">
              <label className="block">
                <span className="mb-1 block font-mono text-[9.5px] uppercase tracking-[0.16em] text-os-dim">Project name</span>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-sm-t border border-os-border bg-os-bg px-2.5 py-2 text-[12px] text-os-text outline-none focus:border-os-border-strong"
                />
              </label>
              <label className="block">
                <span className="mb-1 block font-mono text-[9.5px] uppercase tracking-[0.16em] text-os-dim">Kind</span>
                <select
                  value={form.kind}
                  onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as ProjectKind }))}
                  className="w-full rounded-sm-t border border-os-border bg-os-bg px-2.5 py-2 text-[12px] text-os-text outline-none focus:border-os-border-strong"
                >
                  <option value="local">Local folder</option>
                  <option value="git">Git remote</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block font-mono text-[9.5px] uppercase tracking-[0.16em] text-os-dim">Path or URL</span>
                <input
                  required
                  value={form.pathOrUrl}
                  onChange={(e) => setForm((f) => ({ ...f, pathOrUrl: e.target.value }))}
                  placeholder={form.kind === 'local' ? 'C:/Users/you/source/repos/new-project' : 'https://github.com/you/new-project.git'}
                  className="w-full rounded-sm-t border border-os-border bg-os-bg px-2.5 py-2 text-[12px] text-os-text outline-none focus:border-os-border-strong"
                />
              </label>
            </div>
            {error && <p className="mt-2 font-mono text-[10.5px] text-os-err">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="mt-3 rounded-sm-t border border-os-border bg-os-surface2 px-3 py-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-widest text-os-accent transition-colors hover:border-os-border-strong disabled:opacity-40"
            >
              {busy ? 'promoting…' : 'create project'}
            </button>
            <p className="mt-2 font-mono text-[10px] leading-relaxed text-os-dim">
              Registers a new Project Registry entry, read-only with no agents authorized. Grant access from /projects.
            </p>
          </form>
        </span>
      ) : (
        <button
          onClick={() => setPromoting(true)}
          title="Promote to project"
          className="inline-flex items-center gap-1 rounded-sm-t border border-os-border px-1.5 py-1 font-mono text-[10px] uppercase tracking-widest text-os-dim transition-colors hover:border-os-border-strong hover:text-os-accent"
        >
          <Rocket className="h-3 w-3" /> promote
        </button>
      )}

      {confirming ? (
        <span className="flex items-center gap-1">
          <button
            onClick={() => call({ method: 'DELETE' })}
            disabled={busy}
            className="rounded-sm-t border border-os-border px-1.5 py-1 font-mono text-[10px] uppercase tracking-widest text-os-err transition-colors hover:border-os-border-strong disabled:opacity-40"
          >
            sure?
          </button>
          <button onClick={() => setConfirming(false)} className="font-mono text-[10px] uppercase tracking-widest text-os-dim transition-colors hover:text-os-text">
            no
          </button>
        </span>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          aria-label="Delete idea"
          title="Delete"
          className="text-os-dim opacity-0 transition-opacity hover:text-os-err group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </span>
  );
}
