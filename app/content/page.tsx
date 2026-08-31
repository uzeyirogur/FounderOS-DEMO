import Link from 'next/link';
import { ArrowUpRight, Clapperboard, ExternalLink, Play, Wrench } from 'lucide-react';
import { getDb } from '@/lib/data';
import { contentAgents } from '@/lib/content';
import { zernioRecentPosts, zernioPostDays } from '@/lib/connectors/zernio';
import { PageHeader } from '@/components/PageHeader';
import { LeadMagnets } from '@/components/LeadMagnets';
import { ContentStudioProducer } from '@/components/ContentStudioProducer';
import { Badge, Dot, SectionHead } from '@/components/terminal';
import type { Agent } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

function prettyTool(slug: string): string {
  return slug.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function agoFrom(iso: string | null): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

function platformLabel(p: string): string {
  return p.charAt(0).toUpperCase() + p.slice(1);
}

const AGENT_STATUS_LABEL: Record<string, string> = {
  active: 'Aktif',
  idle: 'Boşta',
  training: 'Eğitimde',
  planned: 'Planlandı',
};

function AgentCard({ agent, lead = false }: { agent: Agent; lead?: boolean }) {
  return (
    <div
      className={`rounded-lg-t border bg-os-surface p-4 ${lead ? 'border-[var(--accent-line)]' : 'border-os-border'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Dot state={agent.status === 'active' ? 'ok' : 'available'} pulse={agent.status === 'active'} />
            <span className="truncate text-[14px] font-bold">{agent.name}</span>
            {lead && <span className="rounded-sm-t border border-[var(--accent-line)] px-1.5 py-px font-mono text-[9px] uppercase tracking-wide text-os-accent">lider</span>}
          </div>
          <div className="mt-0.5 font-mono text-[10.5px] text-os-dim">{agent.role} · {agent.model}</div>
        </div>
        <span className={`shrink-0 font-mono text-[10px] uppercase tracking-wide ${agent.status === 'active' ? 'text-os-ok' : 'text-os-warn'}`}>
          {AGENT_STATUS_LABEL[agent.status] ?? agent.status}
        </span>
      </div>
      <p className="mt-2.5 text-[12px] leading-relaxed text-os-muted [text-wrap:pretty]">{agent.description}</p>
      {agent.tools.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {agent.tools.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-sm-t border border-os-border bg-os-surface2 px-1.5 py-0.5 font-mono text-[10px] text-os-muted">
              <Wrench className="h-2.5 w-2.5" /> {prettyTool(t)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function ContentPage() {
  const leadMagnets = getDb().leadMagnets.all();
  const db = getDb();
  const crew = contentAgents(db.agents.all());
  const lead = crew[0] ?? null;
  const workers = lead ? crew.slice(1) : crew;
  const contentPieces = db.contentPieces.all();

  const posts = await zernioRecentPosts(8).catch(() => []);
  const days = await zernioPostDays().catch(() => []);
  const activeDays = days.filter((d) => d.platforms.length > 0).length;

  return (
    <div>
      <PageHeader
        eyebrow="içerik motoru"
        title="İçerik Üretimi"
        right={<Badge tone="accent">{crew.length} ajan</Badge>}
      />

      {/* Content agent + crew (real seed roster) */}
      <section>
        <SectionHead
          label="İçerik ajanları"
          count={`${crew.length}`}
        />
        <p className="mb-3 flex items-center gap-1.5 text-xs text-os-dim">
          <Clapperboard className="h-3.5 w-3.5" /> Sosyal medyanla bağlantılı — şuradan çalıştır{' '}
          <Link href="/agents" className="inline-flex items-center gap-0.5 text-os-accent hover:underline">
            Ajanlar <ArrowUpRight className="h-3 w-3" />
          </Link>
        </p>
        {lead && <AgentCard agent={lead} lead />}
        {workers.length > 0 && (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {workers.map((a) => (
              <AgentCard key={a.id} agent={a} />
            ))}
          </div>
        )}
      </section>

      {/* Social Content Studio — real production, not just text */}
      <section className="mt-8">
        <SectionHead label="Sosyal İçerik Stüdyosu" count={`${contentPieces.length} üretildi`} />
        <p className="mb-3 text-xs text-os-dim">
          Gönderi ve carousel'ler doğrudan yazılır. Geri kalan her şey (video, görsel, hareket, 3D/web etkileşimli, mockup,
          seslendirme) önce Yetenek Kayıt Defteri'nde gerçek bir araç olup olmadığını kontrol eder — bkz.{' '}
          <Link href="/capabilities" className="inline-flex items-center gap-0.5 text-os-accent hover:underline">
            Yetenekler <ArrowUpRight className="h-3 w-3" />
          </Link>
        </p>
        <ContentStudioProducer recent={contentPieces.slice(0, 6)} />
      </section>

      {/* Zernio content pipeline — recent published content + cadence */}
      <section className="mt-8">
        <SectionHead
          label="Zernio içerik hattı"
          count={posts.length > 0 ? `${posts.length} son` : 'canlı veri yok'}
        />
        <p className="mb-3 flex items-center gap-1.5 text-xs text-os-dim">
          Zernio üzerinden altı platformda yayınlandı · {activeDays} aktif gün izleniyor · tam panel için{' '}
          <Link href="/social" className="inline-flex items-center gap-0.5 text-os-accent hover:underline">
            Sosyal <ArrowUpRight className="h-3 w-3" />
          </Link>
        </p>
        {posts.length > 0 ? (
          <ul className="flex flex-col divide-y divide-os-border overflow-hidden rounded-lg-t border border-os-border bg-os-surface">
            {posts.map((p, i) => (
              <li key={`${p.url}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                <Play className="h-3.5 w-3.5 shrink-0 text-os-dim" />
                <span className="w-24 shrink-0 font-mono text-[10.5px] uppercase tracking-wide text-os-muted">{platformLabel(p.platform)}</span>
                <span className="min-w-0 flex-1 truncate text-[12.5px]">{p.caption || 'İsimsiz gönderi'}</span>
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-os-dim hover:text-os-accent">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
                <span className="w-10 shrink-0 text-right font-mono text-[10px] text-os-dim">{agoFrom(p.publishedAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg-t border border-dashed border-os-border bg-os-surface px-4 py-5 text-center font-mono text-[11.5px] text-os-dim">
            Şu anda canlı bir Zernio verisi yok — API yanıt verdiğinde son içerikler burada görünür (anahtar ~/.config/social/.env içinden).
          </p>
        )}
      </section>

      {/* Lead magnets — every landing page we ship, with the live link */}
      <section className="mt-8">
        <SectionHead label="Potansiyel müşteri mıknatısları" count={`${leadMagnets.filter((m) => m.status === 'live').length} yayında`} />
        <p className="mb-3 flex items-center gap-1.5 text-xs text-os-dim">
          Bir gönderinin arkasında yayınlanan her açılış sayfası ·{' '}
          <Link
            href="/content/lead-magnets"
            className="inline-flex items-center gap-0.5 text-os-accent hover:underline"
          >
            Kayıt defterini aç <ArrowUpRight className="h-3 w-3" />
          </Link>
        </p>
        <LeadMagnets rows={leadMagnets.slice(0, 4)} />
      </section>
    </div>
  );
}
