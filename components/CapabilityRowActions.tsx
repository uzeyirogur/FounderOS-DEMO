'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import type { CapabilityProvider } from '@/lib/schemas';

/**
 * Approve/reject for a Capability Registry candidate. Same shape as
 * NotificationDecideButtons: the local UI is just another caller of the
 * one endpoint that can flip approvedByUser — an agent never calls this.
 */
export function CapabilityRowActions({ capability }: { capability: CapabilityProvider }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (capability.status !== 'candidate') return null;

  const approve = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/capabilities/${encodeURIComponent(capability.id)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedAgents: [] }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/capabilities/${encodeURIComponent(capability.id)}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: null }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="flex items-center gap-1.5">
      <button
        onClick={approve}
        disabled={busy}
        title={capability.costModel === 'paid' || capability.authRequired ? 'Kimlik bilgisi/ücret gerektirir — onaylamak kendisi bir şey harcamaz, ancak satırı kullanım için etkinleştirir' : 'Onayla'}
        className="inline-flex items-center gap-1 rounded-sm-t border border-os-border bg-os-surface2 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-os-ok transition-colors hover:border-os-border-strong disabled:opacity-40"
      >
        <Check className="h-3 w-3" /> onayla
      </button>
      <button
        onClick={reject}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-sm-t border border-os-border px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-os-err transition-colors hover:border-os-border-strong disabled:opacity-40"
      >
        <X className="h-3 w-3" /> reddet
      </button>
    </span>
  );
}
