'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import type { Notification } from '@/lib/schemas';

/**
 * Approve/reject buttons for an approval_request notification. This is the
 * SAME endpoint a future WhatsApp reply handler will call
 * (POST /api/notifications/[id]/decide) — the local UI is not a special
 * case, it is just another caller with decidedBy='local-ui'.
 */
export function NotificationDecideButtons({ notification }: { notification: Notification }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!notification.requiresApproval || notification.status !== 'pending') return null;

  const decide = async (decision: 'approved' | 'rejected') => {
    setBusy(true);
    try {
      const res = await fetch(`/api/notifications/${encodeURIComponent(notification.id)}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, decidedBy: 'local-ui' }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="flex items-center gap-1.5">
      <button
        onClick={() => decide('approved')}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-sm-t border border-os-border bg-os-surface2 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-os-ok transition-colors hover:border-os-border-strong disabled:opacity-40"
      >
        <Check className="h-3 w-3" /> onayla
      </button>
      <button
        onClick={() => decide('rejected')}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-sm-t border border-os-border px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-os-err transition-colors hover:border-os-border-strong disabled:opacity-40"
      >
        <X className="h-3 w-3" /> reddet
      </button>
    </span>
  );
}
