import { getDb } from '@/lib/data';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/terminal';
import { OutboundMessageActions } from '@/components/OutboundMessageActions';

export const dynamic = 'force-dynamic';

const STATUS_TEXT: Record<string, string> = {
  drafted: 'text-os-dim',
  pending_approval: 'text-os-warn',
  approved: 'text-os-accent',
  rejected: 'text-os-err',
  sent: 'text-os-ok',
  failed: 'text-os-err',
};

const STATUS_LABEL: Record<string, string> = {
  drafted: 'taslak',
  pending_approval: 'onay bekliyor',
  approved: 'onaylandı',
  rejected: 'reddedildi',
  sent: 'gönderildi',
  failed: 'hata',
};

/**
 * Communications' outbound queue: every drafted reply to a real inbox or
 * WhatsApp contact. A real send never happens without an explicit
 * approve here first, per the Approval Policy.
 */
export default function OutboundMessagesPage() {
  const rows = getDb().outboundMessages.all();
  const pending = rows.filter((m) => m.status === 'pending_approval').length;

  return (
    <div>
      <PageHeader
        eyebrow="iletişim"
        title="Giden Mesajlar"
        right={<Badge tone={pending > 0 ? 'warn' : 'accent'}>{pending} onay bekliyor</Badge>}
      />
      <p className="mb-4 max-w-[720px] text-[12.5px] leading-relaxed text-os-muted">
        Gerçek bir gelen kutusuna veya WhatsApp kişisine taslak olarak hazırlanmış yanıtlar. Gerçek bir gönderim,
        burada önce açıkça onaylanmadan asla yapılmaz.
      </p>
      {rows.length === 0 ? (
        <p className="rounded-lg-t border border-os-border bg-os-surface px-4 py-3 font-mono text-[10.5px] text-os-dim">
          Henüz giden mesaj yok.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg-t border border-os-border bg-os-surface">
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              <tr className="border-b border-os-border">
                {['Kanal', 'Alıcı', 'Konu / önizleme', 'Durum', 'Oluşturulma', 'İşlemler'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-mono text-[9.5px] uppercase tracking-[0.18em] text-os-dim">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="group border-b border-os-border last:border-b-0 hover:bg-os-surface2">
                  <td className="px-4 py-3 align-top font-mono text-[11px] uppercase tracking-wider text-os-muted">{m.channel}</td>
                  <td className="px-4 py-3 align-top text-[11.5px] text-os-muted">{m.to}</td>
                  <td className="max-w-[280px] px-4 py-3 align-top text-[11.5px] text-os-muted">
                    {m.subject ?? <span className="italic text-os-dim">konu yok</span>} — {m.body.slice(0, 60)}
                    {m.body.length > 60 ? '…' : ''}
                  </td>
                  <td className={`whitespace-nowrap px-4 py-3 align-top font-mono text-[10.5px] uppercase tracking-wider ${STATUS_TEXT[m.status]}`}>
                    {STATUS_LABEL[m.status] ?? m.status.replace(/_/g, ' ')}
                    {m.failureReason && <div className="mt-0.5 max-w-[220px] text-[10px] normal-case text-os-err">{m.failureReason}</div>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-[10.5px] text-os-dim">
                    {new Date(m.createdAt).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    <OutboundMessageActions message={m} />
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
