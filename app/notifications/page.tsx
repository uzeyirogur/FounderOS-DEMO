import { getDb } from '@/lib/data';
import { PageHeader } from '@/components/PageHeader';
import { Badge, SectionHead } from '@/components/terminal';
import { NotificationDecideButtons } from '@/components/NotificationDecideButtons';
import { LifecycleApprovalDecideButtons } from '@/components/LifecycleApprovalDecideButtons';

export const dynamic = 'force-dynamic';

const STATUS_TEXT: Record<string, string> = {
  pending: 'text-os-warn',
  sent: 'text-os-muted',
  approved: 'text-os-ok',
  rejected: 'text-os-err',
  failed: 'text-os-err',
};

const KIND_TEXT: Record<string, string> = {
  daily_report: 'rapor',
  alert: 'uyarı',
  approval_request: 'onay',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'bekliyor',
  sent: 'gönderildi',
  approved: 'onaylandı',
  rejected: 'reddedildi',
  failed: 'hata',
};

/**
 * The report/approval queue's local view — the same rows a WhatsApp delivery
 * worker will eventually push and read replies for (architecture only today;
 * no WhatsApp account is connected — see docs/WHATSAPP_CHANNEL_ARCHITECTURE.md).
 * Every agent-generated report and approval request lands here whether or not
 * any channel is wired up, so nothing an agent wants to tell Alex is ever lost.
 *
 * Also surfaces real Project Lifecycle approval gates (e.g.
 * deployment_approval) — a second, structurally different approval source
 * that previously had a working decide API but no UI anywhere to act on it.
 */
export default function NotificationsPage() {
  const rows = getDb().notifications.all();
  const pendingApprovals = rows.filter((n) => n.requiresApproval && n.status === 'pending').length;
  const pendingLifecycleApprovals = getDb().lifecycleApprovals.pending();

  return (
    <div>
      <PageHeader
        eyebrow="raporlar & onaylar"
        title="Bildirimler"
        right={
          <Badge tone={pendingApprovals + pendingLifecycleApprovals.length > 0 ? 'warn' : 'accent'}>
            {pendingApprovals + pendingLifecycleApprovals.length} karar bekliyor
          </Badge>
        }
      />
      <p className="mb-4 max-w-[720px] text-[12.5px] leading-relaxed text-os-muted">
        Ajanların oluşturduğu her rapor ve onay talebi, kanaldan bağımsız olarak burada listelenir. WhatsApp
        üzerinden iletim şu an sadece mimari düzeyde tasarlanmıştır (hesap bağlı değil) — karar bu ekrandan
        verilebilir; karar uç noktası her iki durumda da aynıdır.
      </p>

      {pendingLifecycleApprovals.length > 0 && (
        <div className="mb-6">
          <SectionHead label="Proje yaşam döngüsü onayları" count={pendingLifecycleApprovals.length} />
          <div className="overflow-x-auto rounded-lg-t border border-os-border bg-os-surface">
            <table className="w-full min-w-[700px] border-collapse">
              <thead>
                <tr className="border-b border-os-border">
                  {['Proje', 'Aşama', 'Başlık', 'Talep eden', 'Karar'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left font-mono text-[9.5px] uppercase tracking-[0.18em] text-os-dim">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pendingLifecycleApprovals.map((a) => (
                  <tr key={a.id} className="group border-b border-os-border last:border-b-0 hover:bg-os-surface2">
                    <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-[11px] text-os-muted">{a.projectId}</td>
                    <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-[10.5px] uppercase tracking-wider text-os-dim">
                      {a.phase}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="text-[13px] font-semibold text-os-text">{a.title}</div>
                      {a.description && <div className="mt-0.5 max-w-[360px] text-[11px] leading-snug text-os-dim">{a.description}</div>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-[11px] text-os-muted">{a.requestedByAgentId}</td>
                    <td className="whitespace-nowrap px-4 py-3 align-top">
                      <LifecycleApprovalDecideButtons approval={a} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="rounded-lg-t border border-os-border bg-os-surface px-4 py-3 font-mono text-[10.5px] text-os-dim">
          Henüz bildirim yok. Zamanlanmış görevler ve ajan eylemleri bunları buraya sıraya alacak.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg-t border border-os-border bg-os-surface">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="border-b border-os-border">
                {['Başlık', 'Ajan', 'Tür', 'Durum', 'Oluşturulma', 'Karar'].map((h) => (
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
                      <div className="mt-1 font-mono text-[10.5px] text-os-muted">yanıt: &quot;{n.responseText}&quot;</div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-[11px] text-os-muted">{n.agentId}</td>
                  <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-[10.5px] uppercase tracking-wider text-os-dim">
                    {KIND_TEXT[n.kind] ?? n.kind}
                  </td>
                  <td className={`whitespace-nowrap px-4 py-3 align-top font-mono text-[10.5px] uppercase tracking-wider ${STATUS_TEXT[n.status] ?? 'text-os-muted'}`}>
                    {STATUS_LABEL[n.status] ?? n.status}
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
