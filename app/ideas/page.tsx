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
      <PageHeader eyebrow="idea generation & scoring" title="Idea Lab" right={<Badge tone="accent">{rows.length} ideas</Badge>} />
      <p className="mb-4 max-w-[720px] text-[12.5px] leading-relaxed text-os-muted">
        Score = market size × 0.4 + ease-to-build × 0.3 + strategic fit × 0.3, out of 5. Every input is a rating you
        (or a future research pass) supply — the number is always traceable back to those three ratings.
      </p>
      <NewIdea />
      {rows.length === 0 ? (
        <p className="rounded-lg-t border border-os-border bg-os-surface px-4 py-3 font-mono text-[10.5px] text-os-dim">
          No ideas yet. Score your first one above.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg-t border border-os-border bg-os-surface">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="border-b border-os-border">
                {['Idea', 'Score', 'Market', 'Ease', 'Fit', 'Status', 'Manage'].map((h) => (
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
                    {idea.status}
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
