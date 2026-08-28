'use client';

import { useMemo, useState } from 'react';
import type { CapabilityProvider } from '@/lib/schemas';
import { categorizeCapability, CAPABILITY_CATEGORIES } from '@/lib/capability-categories';
import { Badge } from '@/components/terminal';
import { CapabilityRowActions } from '@/components/CapabilityRowActions';

const STATUS_TEXT: Record<string, string> = {
  candidate: 'text-os-warn',
  available: 'text-os-muted',
  active: 'text-os-ok',
  rejected: 'text-os-err',
};

const COST_TEXT: Record<string, string> = {
  free: 'text-os-ok',
  freemium: 'text-os-muted',
  paid: 'text-os-warn',
  unknown: 'text-os-dim',
};

const STATUS_FILTERS = ['all', 'candidate', 'available', 'active', 'rejected'] as const;

/**
 * Client-side filter/table for the Capability Registry — status filter
 * (installed/configured/candidate/approved/rejected map onto the real
 * CapabilityStatusSchema values) and category filter (image/video/3D/
 * coding/research/social/publishing/browser/audio/security/analytics,
 * derived from the real capability tag via categorizeCapability — never
 * a second, driftable category field). Filtering happens client-side over
 * data the server already fetched; no extra network round-trip.
 */
export function CapabilityRegistryTable({ rows }: { rows: CapabilityProvider[] }) {
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('all');
  const [category, setCategory] = useState<'all' | (typeof CAPABILITY_CATEGORIES)[number]>('all');

  const filtered = useMemo(
    () =>
      rows.filter((c) => {
        if (status !== 'all' && c.status !== status) return false;
        if (category !== 'all' && categorizeCapability(c.capability) !== category) return false;
        return true;
      }),
    [rows, status, category],
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[9.5px] uppercase tracking-[0.18em] text-os-dim">Status</span>
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-sm-t border px-2 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${
                status === s
                  ? 'border-os-border-strong bg-os-surface2 text-os-text'
                  : 'border-os-border text-os-dim hover:border-os-border-strong'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[9.5px] uppercase tracking-[0.18em] text-os-dim">Category</span>
          <button
            onClick={() => setCategory('all')}
            className={`rounded-sm-t border px-2 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${
              category === 'all'
                ? 'border-os-border-strong bg-os-surface2 text-os-text'
                : 'border-os-border text-os-dim hover:border-os-border-strong'
            }`}
          >
            all
          </button>
          {CAPABILITY_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-sm-t border px-2 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${
                category === c
                  ? 'border-os-border-strong bg-os-surface2 text-os-text'
                  : 'border-os-border text-os-dim hover:border-os-border-strong'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg-t border border-os-border bg-os-surface px-4 py-3 font-mono text-[10.5px] text-os-dim">
          {rows.length === 0
            ? "No capabilities discovered yet. Agents will populate this as tasks need tools this OS doesn't have yet."
            : 'No capabilities match the current filters.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg-t border border-os-border bg-os-surface">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="border-b border-os-border">
                {['Name', 'Capability', 'Category', 'Type', 'Cost', 'Status', 'Auth', 'Allowed agents', 'Decide'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-mono text-[9.5px] uppercase tracking-[0.18em] text-os-dim">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="group border-b border-os-border last:border-b-0 hover:bg-os-surface2">
                  <td className="px-4 py-3 align-top">
                    <div className="text-[13px] font-semibold text-os-text">{c.name}</div>
                    {c.connector && (
                      <div className="mt-1 max-w-[280px] truncate font-mono text-[10px] text-os-dim">{c.connector}</div>
                    )}
                    {c.notes && <div className="mt-1 max-w-[320px] text-[11px] leading-snug text-os-dim">{c.notes}</div>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-[11px] text-os-muted">{c.capability}</td>
                  <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-[10.5px] uppercase tracking-wider text-os-accent">
                    {categorizeCapability(c.capability)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-[10.5px] uppercase tracking-wider text-os-dim">
                    {c.type.replace(/_/g, ' ')}
                  </td>
                  <td className={`whitespace-nowrap px-4 py-3 align-top font-mono text-[10.5px] uppercase tracking-wider ${COST_TEXT[c.costModel]}`}>
                    {c.costModel}
                    {c.freeTier && <div className="mt-0.5 text-[10px] normal-case text-os-dim">{c.freeTier}</div>}
                  </td>
                  <td className={`whitespace-nowrap px-4 py-3 align-top font-mono text-[10.5px] uppercase tracking-wider ${STATUS_TEXT[c.status]}`}>
                    {c.status}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-[10.5px] text-os-muted">
                    {c.authRequired ? 'required' : '—'}
                  </td>
                  <td className="px-4 py-3 align-top text-[11.5px] leading-snug text-os-muted">
                    {c.allowedAgents.length === 0 ? <span className="text-os-dim">none</span> : c.allowedAgents.join(', ')}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    <CapabilityRowActions capability={c} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
