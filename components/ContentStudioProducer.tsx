'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import type { ContentKind, ContentPiece } from '@/lib/schemas';

const KIND_OPTIONS: { value: ContentKind; label: string }[] = [
  { value: 'social_post', label: 'Sosyal gönderi' },
  { value: 'carousel', label: 'Carousel' },
  { value: 'ad_creative', label: 'Reklam kreatifi' },
  { value: 'product_demo_video', label: 'Ürün tanıtım videosu' },
  { value: 'motion_content', label: 'Hareketli içerik' },
  { value: 'short_video', label: 'Kısa video' },
  { value: 'image', label: 'Görsel' },
  { value: 'mockup', label: 'Mockup' },
  { value: 'landing_page_creative', label: 'Açılış sayfası kreatifi' },
  { value: 'voiceover', label: 'Seslendirme' },
  { value: 'animation', label: 'Animasyon' },
  { value: '3d_web_interactive', label: '3D / web etkileşimli' },
];

const STATUS_LABEL: Record<ContentPiece['status'], string> = {
  drafted: 'Taslak',
  needs_capability: 'Yetenek gerekli',
  produced: 'Üretildi',
  failed: 'Başarısız',
};

const STATUS_TEXT: Record<ContentPiece['status'], string> = {
  drafted: 'text-os-dim',
  needs_capability: 'text-os-warn',
  produced: 'text-os-ok',
  failed: 'text-os-err',
};

/**
 * Social Content Studio's real production form: pick a kind, write a brief,
 * hit produce. Text-native kinds (post/carousel) come back written; every
 * other kind either names the real active tool that would make it, or comes
 * back 'needs_capability' with a live-discovered link to review at
 * /capabilities — never a fabricated result.
 */
export function ContentStudioProducer({ recent }: { recent: ContentPiece[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<ContentKind>('social_post');
  const [brief, setBrief] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ContentPiece | null>(null);

  const produce = async () => {
    if (!brief.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/content-pieces/produce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, brief }),
      });
      const body = await res.json();
      if (res.ok) {
        setResult(body.piece);
        setBrief('');
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg-t border border-os-border bg-os-surface p-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-os-dim">Tür</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ContentKind)}
            className="rounded-sm-t border border-os-border bg-os-bg px-2 py-1.5 font-mono text-[11px] text-os-text outline-none focus:border-os-border-strong"
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex min-w-[280px] flex-1 flex-col gap-1">
          <label className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-os-dim">Brief</label>
          <input
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Bu ne söylemeli/göstermeli?"
            className="rounded-sm-t border border-os-border bg-os-bg px-2 py-1.5 text-[12px] text-os-text outline-none focus:border-os-border-strong"
          />
        </div>
        <button
          onClick={produce}
          disabled={busy || !brief.trim()}
          className="inline-flex items-center gap-1.5 rounded-sm-t border border-os-border bg-os-bg px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-os-text transition-colors hover:border-os-border-strong disabled:opacity-40"
        >
          <Sparkles className="h-3 w-3" /> Üret
        </button>
      </div>

      {result && (
        <div className="mt-3 rounded-sm-t border border-os-border bg-os-bg px-3 py-2">
          <div className={`font-mono text-[10px] uppercase tracking-widest ${STATUS_TEXT[result.status]}`}>{STATUS_LABEL[result.status]}</div>
          {result.output && <div className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-os-text">{result.output}</div>}
          {result.requiredCapability && (
            <div className="mt-1 text-[11.5px] text-os-warn">
              Gerekli: <span className="font-mono">{result.requiredCapability}</span> — adayları burada incele{' '}
              <a href="/capabilities" className="underline hover:text-os-accent">/capabilities</a>.
            </div>
          )}
        </div>
      )}

      {recent.length > 0 && (
        <div className="mt-4 border-t border-os-border pt-3">
          <div className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-os-dim">Son üretilenler</div>
          <ul className="space-y-1.5">
            {recent.map((p) => (
              <li key={p.id} className="flex items-start gap-2 text-[11.5px] text-os-muted">
                <span className={`mt-0.5 font-mono text-[9px] uppercase tracking-wider ${STATUS_TEXT[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                <span className="min-w-0 flex-1 truncate">{p.brief}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
