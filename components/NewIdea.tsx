'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';

/**
 * Register an idea from inside the OS. Three 1..5 ratings, nothing else —
 * the score is computed server-side from exactly these inputs, so it can
 * always be explained.
 */
export function NewIdea() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const empty = { title: '', description: '', marketSize: 3, effort: 3, strategicFit: 3 };
  const [form, setForm] = useState(empty);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: k === 'title' || k === 'description' ? e.target.value : Number(e.target.value) }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: unknown };
        setError(typeof body.error === 'string' ? body.error : 'Check the title and ratings (1-5).');
        return;
      }
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
  const rating = 'w-full rounded-sm-t border border-os-border bg-os-bg px-2.5 py-2 text-[12px] text-os-text outline-none focus:border-os-border-strong';

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-4 flex items-center gap-1.5 rounded-sm-t border border-os-border bg-os-surface px-3 py-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-widest text-os-accent transition-colors hover:border-os-border-strong"
      >
        <Plus className="h-3 w-3" /> New idea
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mb-4 rounded-lg-t border border-os-border bg-os-surface p-4">
      <div className="mb-3 flex items-center">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-os-dim">Score an idea</span>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="ml-auto text-os-dim hover:text-os-text">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={label} htmlFor="idea-title">Title</label>
          <input id="idea-title" className={field} value={form.title} onChange={set('title')} required placeholder="Weekly grade digest for parents" />
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="idea-desc">Description</label>
          <textarea id="idea-desc" rows={2} className={`${field} resize-y`} value={form.description} onChange={set('description')} placeholder="What it is, why it might matter" />
        </div>
        <div>
          <label className={label} htmlFor="idea-market">Market size (1-5)</label>
          <input id="idea-market" type="number" min={1} max={5} className={rating} value={form.marketSize} onChange={set('marketSize')} />
        </div>
        <div>
          <label className={label} htmlFor="idea-effort">Ease to build (1-5, 5=easy)</label>
          <input id="idea-effort" type="number" min={1} max={5} className={rating} value={form.effort} onChange={set('effort')} />
        </div>
        <div>
          <label className={label} htmlFor="idea-fit">Strategic fit (1-5)</label>
          <input id="idea-fit" type="number" min={1} max={5} className={rating} value={form.strategicFit} onChange={set('strategicFit')} />
        </div>
      </div>
      {error && <p className="mt-2 font-mono text-[10.5px] text-os-err">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="mt-3 rounded-sm-t border border-os-border bg-os-surface2 px-3 py-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-widest text-os-accent transition-colors hover:border-os-border-strong disabled:opacity-40"
      >
        {busy ? 'saving…' : 'score it'}
      </button>
    </form>
  );
}
