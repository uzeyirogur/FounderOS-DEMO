'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Send } from 'lucide-react';
import type { PublishPlan } from '@/lib/schemas';

/** Approve/reject + attempt-publish controls for one plan. Same shape as
 *  NotificationDecideButtons — the local UI is just another caller of the
 *  same endpoints an automated approval channel would use. */
export function PublishPlanActions({ plan }: { plan: PublishPlan }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const decide = async (decision: 'approved' | 'rejected') => {
    setBusy(true);
    try {
      const res = await fetch(`/api/publish-plans/${encodeURIComponent(plan.id)}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, decidedBy: 'local-ui' }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/publish-plans/${encodeURIComponent(plan.id)}/publish`, { method: 'POST' });
      const body = await res.json();
      setResult(body.result?.reason ?? (body.result?.ok ? 'Yayınlandı.' : 'Başarısız.'));
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {plan.status === 'pending_approval' && (
        <span className="flex items-center gap-1.5">
          <button
            onClick={() => decide('approved')}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-sm-t border border-os-border bg-os-surface2 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-os-ok disabled:opacity-40"
          >
            <Check className="h-3 w-3" /> onayla
          </button>
          <button
            onClick={() => decide('rejected')}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-sm-t border border-os-border px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-os-err disabled:opacity-40"
          >
            <X className="h-3 w-3" /> reddet
          </button>
        </span>
      )}
      {plan.status === 'approved' && (
        <button
          onClick={publish}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-sm-t border border-os-border px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-os-accent disabled:opacity-40"
        >
          <Send className="h-3 w-3" /> yayınlamayı dene
        </button>
      )}
      {result && <div className="mt-1 max-w-[260px] text-[10.5px] text-os-dim">{result}</div>}
    </div>
  );
}
