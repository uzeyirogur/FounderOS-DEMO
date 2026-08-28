import { GitBranch, FolderCog, Minus } from 'lucide-react';
import { ProjectRowActions } from '@/components/ProjectRowActions';
import type { Project } from '@/lib/schemas';

/**
 * The Project Registry, as a Notion-style database — same shape as
 * LeadMagnets. Every project any agent may touch lives here, with its
 * permission level spelled out in the open rather than buried in code.
 */
const KIND = {
  local: { Icon: FolderCog, label: 'Local' },
  git: { Icon: GitBranch, label: 'Git' },
} as const;

const STATUS: Record<Project['status'], { dot: string; text: string }> = {
  active: { dot: 'bg-os-ok', text: 'text-os-ok' },
  paused: { dot: 'bg-os-warn', text: 'text-os-warn' },
  archived: { dot: 'bg-os-dim', text: 'text-os-dim' },
};

const PERMISSION_LABEL: Record<Project['permissionLevel'], string> = {
  read_only: 'Read only',
  auto_safe_write: 'Auto (safe writes)',
  full_with_approval: 'Full (needs approval)',
};

export function ProjectsTable({
  rows,
  agentNames,
  manage = false,
}: {
  rows: Project[];
  /** agentId → display name, so authorized agents read as names, not slugs. */
  agentNames: Record<string, string>;
  manage?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg-t border border-os-border bg-os-surface px-4 py-3 font-mono text-[10.5px] text-os-dim">
        No projects registered yet. Add one so an agent has something it is explicitly allowed to touch.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg-t border border-os-border bg-os-surface">
      <table className="w-full min-w-[820px] border-collapse">
        <thead>
          <tr className="border-b border-os-border">
            {['Name', 'Kind', 'Status', 'Permission', 'Authorized agents', 'Purpose', ...(manage ? ['Manage'] : [])].map(
              (h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left font-mono text-[9.5px] uppercase tracking-[0.18em] text-os-dim"
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const s = STATUS[p.status];
            const k = KIND[p.kind];
            return (
              <tr key={p.id} className="group border-b border-os-border last:border-b-0 hover:bg-os-surface2">
                <td className="px-4 py-3 align-top">
                  <a href={`/projects/${encodeURIComponent(p.id)}`} className="text-[13px] font-semibold text-os-text hover:text-os-accent hover:underline">
                    {p.name}
                  </a>
                  <div className="mt-1 max-w-[320px] truncate font-mono text-[10px] text-os-dim">{p.pathOrUrl}</div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 align-top">
                  <span className="inline-flex items-center gap-1.5 rounded-sm-t border border-os-border bg-os-bg px-2 py-0.5 font-mono text-[10px] text-os-muted">
                    <k.Icon className="h-3 w-3" /> {k.label}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 align-top">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 shrink-0 ${s.dot}`} />
                    <span className={`font-mono text-[10.5px] uppercase tracking-wider ${s.text}`}>{p.status}</span>
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-[10.5px] text-os-muted">
                  {PERMISSION_LABEL[p.permissionLevel]}
                </td>
                <td className="px-4 py-3 align-top text-[11.5px] leading-snug text-os-muted">
                  {p.authorizedAgentIds.length === 0 ? (
                    <span className="inline-flex items-center gap-1 text-os-dim">
                      <Minus className="h-3 w-3" /> none authorized
                    </span>
                  ) : (
                    p.authorizedAgentIds.map((id) => agentNames[id] ?? id).join(', ')
                  )}
                </td>
                <td className="max-w-[280px] px-4 py-3 align-top text-[11.5px] leading-snug text-os-muted">
                  {p.purpose || <span className="text-os-dim">—</span>}
                </td>
                {manage && (
                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    <ProjectRowActions project={p} />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
