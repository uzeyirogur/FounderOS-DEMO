import { getDb } from '@/lib/data';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/terminal';
import { NotificationDecideButtons } from '@/components/NotificationDecideButtons';

export const dynamic = 'force-dynamic';

const STATUS_TEXT: Record<string, string> = {
  pending: 'text-os-warn',
  sent: 'text-os-muted',
  approved: 'text-os-ok',
  rejected: 'text-os-err',
  failed: 'text-os-err',
};

const KIND_TEXT: Record<string, string> = {
  daily_report: 'report',
  alert: 'alert',
  approval_request: 'approval',
};

/**
 * The report/approval queue's local view — the same rows a WhatsApp delivery
 * worker will eventually push and read replies for (architecture only today;
 * no WhatsApp account is connected — see docs/WHATSAPP_CHANNEL_ARCHITECTURE.md).
 * Every agent-generated report and approval request lands here whether or not
 * any channel is wired up, so nothing an agent wants to tell Alex is ever lost.
 */
export default function NotificationsPage() {
  const rows = getDb().notifications.all();
  const pendingApprovals = rows.filter((n) => n.requiresApproval && n.status === 'pending').length;

  return (
    <div>
      <PageHeader
        eyebrow="reports & approvals"
        title="Notifications"
        right={<Badge tone={pendingApprovals > 0 ? 'warn' : 'accent'}>{pendingApprovals} awaiting decision</Badge>}
      />
      <p className="mb-4 max-w-[720px] text-[12.5px] leading-relaxed text-os-muted">
        Every agent-generated report and approval request, channel-agnostic. WhatsApp delivery is architecture-only
        right now (no account connected) — decide here in the meantime; the decide endpoint is identical either way.
      </p>
      {rows.length === 0 ? (
        <p className="rounded-lg-t border border-os-border bg-os-surface px-4 py-3 font-mono text-[10.5px] text-os-dim">
          No notifications yet. Cron runs and agent actions will queue them here.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg-t border border-os-border bg-os-surface">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="border-b border-os-border">
                {['Title', 'Agent', 'Kind', 'Status', 'Created', 'Decide'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-mono text-[9.5px] uppercase tracking-[0.18em] text-os-dim">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => (
                <tr key={n.id} className="group border-b border-os-border last:border-b-0 hover:bg-os-surface2">
                  <td className="px-4 py-3 align-top">
                    <div className="text-[13px] font-semibold text-os-text">{n.title}</div>
                    <div className="mt-0.5 max-w-[420px] text-[11px] leading-snug text-os-dim">{n.body}</div>
                    {n.responseText && (
                      <div className="mt-1 font-mono text-[10.5px] text-os-muted">reply: &quot;{n.responseText}&quot;</div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-[11px] text-os-muted">{n.agentId}</td>
                  <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-[10.5px] uppercase tracking-wider text-os-dim">
                    {KIND_TEXT[n.kind] ?? n.kind}
                  </td>
                  <td className={`whitespace-nowrap px-4 py-3 align-top font-mono text-[10.5px] uppercase tracking-wider ${STATUS_TEXT[n.status] ?? 'text-os-muted'}`}>
                    {n.status}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-[10.5px] text-os-dim">
                    {new Date(n.createdAt).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    <NotificationDecideButtons notification={n} />
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
