import { getDb } from '@/lib/data';
import { PageHeader } from '@/components/PageHeader';
import { NewIdea } from '@/components/NewIdea';
import { IdeaRowActions } from '@/components/IdeaRowActions';
import { Badge } from '@/components/terminal';
import { scoreIdea } from '@/lib/ideas';

export const dynamic = 'force-dynamic';

const STATUS_TEXT: Record<string, string> = {
  new: 'text-os-muted',
  researching: 'text-os-warn',
  scored: 'text-os-accent',
  shipped: 'text-os-ok',
  archived: 'text-os-dim',
};

const STATUS_LABEL: Record<string, string> = {
  new: 'Yeni',
  researching: 'Araştırılıyor',
  scored: 'Puanlandı',
  shipped: 'Yayınlandı',
  archived: 'Arşivlendi',
};

/**
 * Idea Lab, full page. Every idea, ranked by a transparent weighted score
 * (market size 40% + ease-to-build 30% + strategic fit 30%) — never an
 * opaque "AI opinion" number. The highest-leverage idea is always first.
 */
export default function IdeasPage() {
  const rows = getDb()
    .ideas.all()
    .map((i) => ({ ...i, score: scoreIdea(i) }))
    .sort((a, b) => b.score - a.score);

  return (
    <div>
      <PageHeader eyebrow="fikir üretimi ve puanlama" title="Fikir Laboratuvarı" right={<Badge tone="accent">{rows.length} fikir</Badge>} />
      <p className="mb-4 max-w-[720px] text-[12.5px] leading-relaxed text-os-muted">
        Puan = pazar büyüklüğü × 0.4 + geliştirme kolaylığı × 0.3 + stratejik uyum × 0.3, 5 üzerinden. Her girdi senin (ya da
        ileride yapılacak bir araştırmanın) verdiği bir puandır — sonuç her zaman bu üç puana geri izlenebilir.
      </p>
      <NewIdea />
      {rows.length === 0 ? (
        <p className="rounded-lg-t border border-os-border bg-os-surface px-4 py-3 font-mono text-[10.5px] text-os-dim">
          Henüz fikir yok. İlk fikrini yukarıda puanla.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg-t border border-os-border bg-os-surface">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="border-b border-os-border">
                {['Fikir', 'Puan', 'Pazar', 'Kolaylık', 'Uyum', 'Durum', 'Yönet'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-mono text-[9.5px] uppercase tracking-[0.18em] text-os-dim">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((idea) => (
                <tr key={idea.id} className="group border-b border-os-border last:border-b-0 hover:bg-os-surface2">
                  <td className="px-4 py-3 align-top">
                    <div className="text-[13px] font-semibold text-os-text">{idea.title}</div>
                    {idea.description && <div className="mt-0.5 max-w-[360px] text-[11px] leading-snug text-os-dim">{idea.description}</div>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-[13px] font-bold text-os-accent">{idea.score.toFixed(2)}</td>
                  <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-[11px] text-os-muted">{idea.marketSize}/5</td>
                  <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-[11px] text-os-muted">{idea.effort}/5</td>
                  <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-[11px] text-os-muted">{idea.strategicFit}/5</td>
                  <td className={`whitespace-nowrap px-4 py-3 align-top font-mono text-[10.5px] uppercase tracking-wider ${STATUS_TEXT[idea.status] ?? 'text-os-muted'}`}>
                    {STATUS_LABEL[idea.status] ?? idea.status}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    <IdeaRowActions idea={idea} />
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
