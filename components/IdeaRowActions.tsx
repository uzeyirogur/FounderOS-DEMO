'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import type { Idea, IdeaStatus } from '@/lib/schemas';

const STATUSES: IdeaStatus[] = ['new', 'researching', 'scored', 'shipped', 'archived'];

export function IdeaRowActions({ idea }: { idea: Idea }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

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
