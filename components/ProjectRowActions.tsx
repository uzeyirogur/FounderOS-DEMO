'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import type { Project, ProjectPermissionLevel, ProjectStatus } from '@/lib/schemas';

/**
 * Per-row controls for the Project Registry: change status or permission
 * level, or drop the row. Same confirm-inline delete pattern as
 * LeadMagnetRowActions — these rows can carry an agent's write authority, so
 * a stray click should not silently revoke or grant it.
 */
const STATUSES: ProjectStatus[] = ['active', 'paused', 'archived'];
const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: 'Aktif',
  paused: 'Duraklatıldı',
  archived: 'Arşivlendi',
};
const PERMISSIONS: { value: ProjectPermissionLevel; label: string }[] = [
  { value: 'read_only', label: 'Salt okuma' },
  { value: 'auto_safe_write', label: 'Otomatik (güvenli yazma)' },
  { value: 'full_with_approval', label: 'Tam (onay gerekli)' },
];

export function ProjectRowActions({ project }: { project: Project }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const call = async (init: RequestInit) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}`, {
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
        aria-label="Durum"
        disabled={busy}
        value={project.status}
        onChange={(e) => call({ method: 'PATCH', body: JSON.stringify({ status: e.target.value }) })}
        className="rounded-sm-t border border-os-border bg-os-bg px-1.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-os-muted outline-none focus:border-os-border-strong disabled:opacity-40"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <select
        aria-label="İzin seviyesi"
        disabled={busy}
        value={project.permissionLevel}
        onChange={(e) => call({ method: 'PATCH', body: JSON.stringify({ permissionLevel: e.target.value }) })}
        className="rounded-sm-t border border-os-border bg-os-bg px-1.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-os-muted outline-none focus:border-os-border-strong disabled:opacity-40"
      >
        {PERMISSIONS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      {confirming ? (
        <span className="flex items-center gap-1">
          <button
            onClick={() => call({ method: 'DELETE' })}
            disabled={busy}
            className="rounded-sm-t border border-os-border px-1.5 py-1 font-mono text-[10px] uppercase tracking-widest text-os-err transition-colors hover:border-os-border-strong disabled:opacity-40"
          >
            emin misin?
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="font-mono text-[10px] uppercase tracking-widest text-os-dim transition-colors hover:text-os-text"
          >
            hayır
          </button>
        </span>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          aria-label="Projeyi kaldır"
          title="Kaldır"
          className="text-os-dim opacity-0 transition-opacity hover:text-os-err group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </span>
  );
}
