import { getDb } from '@/lib/data';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/terminal';
import { PublishPlanActions } from '@/components/PublishPlanActions';

export const dynamic = 'force-dynamic';

const STATUS_TEXT: Record<string, string> = {
  drafted: 'text-os-dim',
  pending_approval: 'text-os-warn',
  approved: 'text-os-accent',
  rejected: 'text-os-err',
  published: 'text-os-ok',
  failed: 'text-os-err',
};

const STATUS_LABEL: Record<string, string> = {
  drafted: 'taslak',
  pending_approval: 'onay bekliyor',
  approved: 'onaylandı',
  rejected: 'reddedildi',
  published: 'yayınlandı',
  failed: 'hata',
};

/**
 * Social Publishing's queue: every plan naming which channels a Content
 * Studio piece goes to. Separate from Content Studio by design — this is
 * WHERE and HOW something is published, gated on an explicit approval
 * before any live posting is attempted.
 */
export default function PublishPlansPage() {
  const rows = getDb().publishPlans.all();
  const pending = rows.filter((p) => p.status === 'pending_approval').length;

  return (
    <div>
      <PageHeader
        eyebrow="yayın planlama"
        title="Yayın Planları"
        right={<Badge tone={pending > 0 ? 'warn' : 'accent'}>{pending} onay bekliyor</Badge>}
      />
      <p className="mb-4 max-w-[720px] text-[12.5px] leading-relaxed text-os-muted">
        Üretilen bir içeriğin hangi kanallara gideceği ve başlığın her platforma nasıl uyarlandığı. Gerçek bir
        paylaşım, burada önce açıkça onaylanmadan asla yapılmaz.
      </p>
      {rows.length === 0 ? (
        <p className="rounded-lg-t border border-os-border bg-os-surface px-4 py-3 font-mono text-[10.5px] text-os-dim">
          Henüz yayın planı yok.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg-t border border-os-border bg-os-surface">
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              <tr className="border-b border-os-border">
                {['İçerik', 'Platformlar', 'Durum', 'Oluşturulma', 'İşlemler'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-mono text-[9.5px] uppercase tracking-[0.18em] text-os-dim">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="group border-b border-os-border last:border-b-0 hover:bg-os-surface2">
                  <td className="px-4 py-3 align-top font-mono text-[11px] text-os-muted">{p.contentPieceId}</td>
                  <td className="px-4 py-3 align-top text-[11.5px] text-os-muted">{p.platforms.join(', ')}</td>
                  <td className={`whitespace-nowrap px-4 py-3 align-top font-mono text-[10.5px] uppercase tracking-wider ${STATUS_TEXT[p.status]}`}>
                    {STATUS_LABEL[p.status] ?? p.status.replace(/_/g, ' ')}
                    {p.failureReason && <div className="mt-0.5 max-w-[220px] text-[10px] normal-case text-os-err">{p.failureReason}</div>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-[10.5px] text-os-dim">
                    {new Date(p.createdAt).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    <PublishPlanActions plan={p} />
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
