'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import type { CreativeBrief, CreativeFormat } from '@/lib/schemas';

const FORMAT_OPTIONS: { value: CreativeFormat; label: string }[] = [
  { value: 'social_post', label: 'Sosyal gönderi' },
  { value: 'carousel', label: 'Carousel' },
  { value: 'short_video', label: 'Kısa video' },
  { value: 'static_ad', label: 'Statik reklam' },
  { value: 'landing_page', label: 'Açılış sayfası' },
  { value: 'demo_video', label: 'Tanıtım videosu' },
];

/** Ad/Creative Research's real research form for a single project: pick a
 *  candidate format, write a query, get a real web-search-backed creative
 *  brief with sources — or an honest error if the search connector isn't
 *  configured. */
export function CreativeResearchPanel({ projectId, briefs }: { projectId: string; briefs: CreativeBrief[] }) {
  const router = useRouter();
  const [format, setFormat] = useState<CreativeFormat>('short_video');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreativeBrief | null>(null);

  const research = async () => {
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/creative-briefs/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, format, query }),
      });
      const body = await res.json();
      if (res.ok) {
        setResult(body.brief);
        setQuery('');
        router.refresh();
      } else {
        setError(body.error ?? 'Araştırma başarısız oldu.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg-t border border-os-border bg-os-surface p-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-os-dim">Format</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as CreativeFormat)}
            className="rounded-sm-t border border-os-border bg-os-bg px-2 py-1.5 font-mono text-[11px] text-os-text outline-none focus:border-os-border-strong"
          >
            {FORMAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex min-w-[280px] flex-1 flex-col gap-1">
          <label className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-os-dim">Sorgu</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hangi rakip kreatifini araştırmalıyız?"
            className="rounded-sm-t border border-os-border bg-os-bg px-2 py-1.5 text-[12px] text-os-text outline-none focus:border-os-border-strong"
          />
        </div>
        <button
          onClick={research}
          disabled={busy || !query.trim()}
          className="inline-flex items-center gap-1.5 rounded-sm-t border border-os-border bg-os-bg px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-os-text transition-colors hover:border-os-border-strong disabled:opacity-40"
        >
          <Sparkles className="h-3 w-3" /> Araştır
        </button>
      </div>

      {error && <p className="mt-2 font-mono text-[10.5px] text-os-err">{error}</p>}

      {result && (
        <div className="mt-3 rounded-sm-t border border-os-border bg-os-bg px-3 py-2">
          <div className="whitespace-pre-wrap text-[12px] leading-relaxed text-os-text">{result.recommendation}</div>
          {result.sources.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {result.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[10.5px] text-os-accent hover:underline">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {briefs.length > 0 && (
        <div className="mt-4 border-t border-os-border pt-3">
          <div className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-os-dim">Geçmiş briefler</div>
          <ul className="space-y-1.5">
            {briefs.map((b) => (
              <li key={b.id} className="text-[11.5px] text-os-muted">
                <span className="font-mono text-[9px] uppercase tracking-wider text-os-dim">{b.format}</span>{' '}
                {b.query}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
