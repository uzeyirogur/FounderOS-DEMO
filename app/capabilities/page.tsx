import { getDb } from '@/lib/data';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/terminal';
import { CapabilityRowActions } from '@/components/CapabilityRowActions';

export const dynamic = 'force-dynamic';

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

/**
 * The Capability / Tool Registry: every way of doing a thing any agent has
 * ever found or been given, from bare 'candidate' (AI Intelligence found it
 * via web search, nobody has decided anything yet) to 'active' (installed,
 * configured, and approved). This is the shared infrastructure the whole
 * Approval Policy hangs on — nothing paid or credentialed here can be used
 * by an agent until a human clicks approve.
 */
export default function CapabilitiesPage() {
  const rows = getDb().capabilities.all();
  const pending = rows.filter((c) => c.status === 'candidate').length;

  return (
    <div>
      <PageHeader
        eyebrow="shared infrastructure"
        title="Capability Registry"
        right={<Badge tone={pending > 0 ? 'warn' : 'accent'}>{pending} awaiting review</Badge>}
      />
      <p className="mb-4 max-w-[760px] text-[12.5px] leading-relaxed text-os-muted">
        Every MCP server, API, CLI, SDK, SKILL.md, GitHub repo, hosted service, or media-generation tool any agent
        has discovered or been given. AI Intelligence adds new rows as &apos;candidate&apos; when a task needs a
        capability nothing active covers — a paid or auth-required candidate never activates itself; approve it here
        first.
      </p>
      {rows.length === 0 ? (
        <p className="rounded-lg-t border border-os-border bg-os-surface px-4 py-3 font-mono text-[10.5px] text-os-dim">
          No capabilities discovered yet. Agents will populate this as tasks need tools this OS doesn&apos;t have yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg-t border border-os-border bg-os-surface">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="border-b border-os-border">
                {['Name', 'Capability', 'Type', 'Cost', 'Status', 'Auth', 'Allowed agents', 'Decide'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-mono text-[9.5px] uppercase tracking-[0.18em] text-os-dim">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="group border-b border-os-border last:border-b-0 hover:bg-os-surface2">
                  <td className="px-4 py-3 align-top">
                    <div className="text-[13px] font-semibold text-os-text">{c.name}</div>
                    {c.connector && (
                      <div className="mt-1 max-w-[280px] truncate font-mono text-[10px] text-os-dim">{c.connector}</div>
                    )}
                    {c.notes && <div className="mt-1 max-w-[320px] text-[11px] leading-snug text-os-dim">{c.notes}</div>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-[11px] text-os-muted">{c.capability}</td>
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
