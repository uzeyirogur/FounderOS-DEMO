'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';

/**
 * Register a project from inside the OS. No project is hardcoded into agent
 * logic — this is the only way one enters the registry (besides the seed).
 * A project starts read_only with no authorized agents: registering it
 * grants no access by itself.
 */
export function NewProject() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const empty = {
    name: '',
    kind: 'local' as 'local' | 'git',
    pathOrUrl: '',
    purpose: '',
  };
  const [form, setForm] = useState(empty);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: unknown };
        setError(typeof body.error === 'string' ? body.error : 'Check the name and the path or URL.');
        return;
      }
      const body = (await res.json()) as { project?: { name?: string } };
      setDone(body.project?.name ?? form.name);
      setForm(empty);
      setOpen(false);
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const field =
    'w-full rounded-sm-t border border-os-border bg-os-bg px-2.5 py-2 text-[12px] text-os-text outline-none placeholder:text-os-dim focus:border-os-border-strong';
  const label = 'mb-1 block font-mono text-[9.5px] uppercase tracking-[0.16em] text-os-dim';

  if (!open) {
    return (
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => {
            setDone(null);
            setOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-sm-t border border-os-border bg-os-surface px-3 py-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-widest text-os-accent transition-colors hover:border-os-border-strong"
        >
          <Plus className="h-3 w-3" /> New project
        </button>
        {done && <span className="font-mono text-[10.5px] text-os-ok">Registered {done}.</span>}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mb-4 rounded-lg-t border border-os-border bg-os-surface p-4">
      <div className="mb-3 flex items-center">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-os-dim">Register a project</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="ml-auto text-os-dim hover:text-os-text"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="pr-name">
            Name
          </label>
          <input id="pr-name" className={field} value={form.name} onChange={set('name')} required placeholder="TIVARO" />
        </div>
        <div>
          <label className={label} htmlFor="pr-kind">
            Kind
          </label>
          <select id="pr-kind" className={field} value={form.kind} onChange={set('kind')}>
            <option value="local">Local folder</option>
            <option value="git">Git repository</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="pr-path">
            {form.kind === 'git' ? 'Git URL' : 'Local path'}
          </label>
          <input
            id="pr-path"
            className={field}
            value={form.pathOrUrl}
            onChange={set('pathOrUrl')}
            required
            placeholder={form.kind === 'git' ? 'https://github.com/…' : 'C:/Users/HP/source/repos/…'}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="pr-purpose">
            Purpose
          </label>
          <textarea
            id="pr-purpose"
            rows={2}
            className={`${field} resize-y`}
            value={form.purpose}
            onChange={set('purpose')}
            placeholder="What this project is and why an agent might work on it"
          />
        </div>
      </div>
      <p className="mt-2 font-mono text-[10px] text-os-dim">
        New projects start read-only with no authorized agents. Grant access from the row after it lands.
      </p>
      {error && <p className="mt-2 font-mono text-[10.5px] text-os-err">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="mt-3 rounded-sm-t border border-os-border bg-os-surface2 px-3 py-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-widest text-os-accent transition-colors hover:border-os-border-strong disabled:opacity-40"
      >
        {busy ? 'saving…' : 'register project'}
      </button>
    </form>
  );
}
