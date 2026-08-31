import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { getDb } from '@/lib/data';
import { allConnectorStatuses } from '@/lib/connectors';
import { PageHeader } from '@/components/PageHeader';
import { Dot, Kbd, Label, SectionHead } from '@/components/terminal';
import type { ConnectorStatus } from '@/lib/connectors/types';
import { projectLifecycleSummary } from '@/lib/project-lifecycle-orchestrator';
import { aggregateStatus } from '@/lib/conductor';
import { buildExecutiveReport } from '@/lib/agents/executive-report';

export const dynamic = 'force-dynamic';

/**
 * Command Center — production dashboard, 2026-08-31 audit rewrite.
 *
 * Rule: only real production data appears here. Every widget below reads
 * straight from the same repos/services the dedicated pages use — never a
 * second, hand-maintained number, and never a seeded/demo/fabricated value.
 * A widget with no real data source shows an honest empty state ("Veri yok",
 * "Bağlı değil", 0) instead of being hidden with fake content.
 *
 * Removed in this pass (were seed-dummy or fabricated, see
 * docs/PRODUCTION_DEPLOYMENT.md for the audit record):
 *  - Social media audience/follower graph (lib/social.ts audienceSeries —
 *    seeded ramp() follower counts and fake growth percentages, no real
 *    Zernio/Postly credential in this deployment)
 *  - Posting-consistency chart (lib/social.ts postingCadenceByPlatform —
 *    a deterministic HASH, not real published-post history)
 *  - The scrolling "live" run ticker (decorative marquee, duplicated the
 *    Son Çalışmalar list below with no added information)
 *  - Roadmap "Now" preview (lib/seed.ts roadmap — a hardcoded product plan
 *    from the original FounderOS demo project, not this operator's data)
 *  - G-Brain knowledge card (this deployment has no gbrain CLI on PATH —
 *    always "spawn gbrain ENOENT"; the real state is visible on /brain)
 */

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'İyi geceler';
  if (hour < 12) return 'Günaydın';
  if (hour < 18) return 'İyi günler';
  return 'İyi akşamlar';
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'az önce';
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'az önce';
  if (m < 60) return `${m}dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}sa önce`;
  return `${Math.floor(h / 24)}g önce`;
}

/** Clickable stat tile that routes to its detail page. Every value passed in
 *  must be a real count from the caller — this component never invents one. */
function StatTile({
  href,
  label,
  value,
  unit,
}: {
  href: string;
  label: string;
  value: React.ReactNode;
  unit: string;
}) {
  return (
    <Link
      href={href}
      className="hoverable group flex flex-col gap-2 rounded-lg-t border border-os-border bg-os-surface px-[18px] py-4"
    >
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <ArrowUpRight className="h-3.5 w-3.5 text-os-dim opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div className="flex items-baseline gap-[7px] font-mono text-[26px] font-semibold tracking-[-0.02em]">
        {value}
        <small className="whitespace-nowrap text-xs font-normal text-os-dim">{unit}</small>
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const db = getDb();
  const connections = await allConnectorStatuses();

  const agents = db.agents.all();
  const recentRuns = db.agentRuns.recent(8);
  const runsToday = db.agentRuns.recent(500).filter((r) => {
    const d = new Date(r.startedAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  const connected = connections.filter((c) => c.state === 'connected').length;
  const activeAgents = agents.filter((a) => a.status === 'active').length;

  // Active Projects — real Project Registry rows + their real lifecycle state.
  const activeProjects = db.projects.all().filter((p) => p.status === 'active');
  const projectLifecycles = activeProjects.map((p) => ({ project: p, lifecycle: projectLifecycleSummary(db, p.id) }));

  // Waiting on you — real cross-system blocker count (lifecycle approvals,
  // publish plans, outbound messages, capability candidates, blocked content).
  const conductorStatus = aggregateStatus(db);
  const notConfiguredCapabilities = db.capabilities.all().filter((c) => c.status === 'candidate' && !c.configured);

  // Latest report — the real Executive Reporter digest over the last 24h,
  // built from real agent_runs rows, never invented commentary.
  const latestReport = buildExecutiveReport(db, { windowHours: 24 });

  return (
    <div>
      <PageHeader eyebrow="operatör konsolu" title={`${greeting()}, Alex`} caret right={<Kbd>⌘K</Kbd>} />

      {/* Pulse row — every count below is a real, live number. */}
      <section className="mb-[22px] grid grid-cols-4 gap-3 max-[1100px]:grid-cols-2">
        <StatTile href="/projects" label="Aktif projeler" value={activeProjects.length} unit="proje" />
        <StatTile
          href="/notifications"
          label="Benden bekleyen"
          value={conductorStatus.totalBlockers}
          unit="onay/karar"
        />
        <StatTile href="/agents" label="Ajan durumu" value={activeAgents} unit={`/ ${agents.length} aktif`} />
        <StatTile href="/integrations" label="Bağlantılar" value={connected} unit={`/ ${connections.length} bağlı`} />
      </section>

      <div className="grid grid-cols-2 gap-3 max-[1100px]:grid-cols-1">
        {/* Aktif Projeler */}
        <section className="rounded-lg-t border border-os-border bg-os-surface p-4">
          <SectionHead label="Aktif projeler" count={activeProjects.length} link="Tüm projeler" href="/projects" />
          {projectLifecycles.length === 0 ? (
            <p className="text-[12px] text-os-dim">Henüz aktif proje yok.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {projectLifecycles.map(({ project, lifecycle }) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="hoverable flex items-center gap-2.5 rounded-sm-t border border-os-border bg-os-bg px-3 py-2 font-mono text-[11px]"
                >
                  <span className="shrink-0 font-semibold text-os-text">{project.name}</span>
                  <span className="shrink-0 text-os-accent">{lifecycle.currentPhase}</span>
                  <span className="min-w-0 flex-1 truncate text-os-dim">{lifecycle.nextAction}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Benden Bekleyen Onaylar */}
        <section className="rounded-lg-t border border-os-border bg-os-surface p-4">
          <SectionHead
            label="Benden bekleyen onaylar"
            count={conductorStatus.totalBlockers}
            link="Bildirimler"
            href="/notifications"
          />
          {conductorStatus.totalBlockers === 0 ? (
            <p className="text-[12px] text-os-dim">Şu an bekleyen bir karar yok.</p>
          ) : (
            <ul className="flex flex-col gap-1 font-mono text-[11px] text-os-muted">
              {conductorStatus.pendingLifecycleApprovals > 0 && (
                <li>{conductorStatus.pendingLifecycleApprovals} proje onayı</li>
              )}
              {conductorStatus.pendingPublishPlans > 0 && <li>{conductorStatus.pendingPublishPlans} yayın planı</li>}
              {conductorStatus.pendingOutboundMessages > 0 && (
                <li>{conductorStatus.pendingOutboundMessages} giden mesaj</li>
              )}
              {conductorStatus.candidateCapabilities > 0 && (
                <li>
                  {conductorStatus.candidateCapabilities} yetenek adayı
                  {notConfiguredCapabilities.length > 0
                    ? ` — kurulum bekliyor: ${notConfiguredCapabilities.slice(0, 3).map((c) => c.name).join(', ')}`
                    : ''}
                </li>
              )}
              {conductorStatus.blockedContentPieces > 0 && (
                <li>{conductorStatus.blockedContentPieces} içerik parçası (yetenek bekliyor)</li>
              )}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 max-[1100px]:grid-cols-1">
        {/* Son Çalışmalar */}
        <section className="rounded-lg-t border border-os-border bg-os-surface p-4">
          <SectionHead label="Son çalışmalar" count={recentRuns.length} link="Ajanlar" href="/agents" />
          {recentRuns.length === 0 ? (
            <p className="text-[12px] text-os-dim">Henüz kayıtlı bir ajan çalışması yok.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {recentRuns.map((r) => (
                <li
                  key={r.id}
                  className="flex items-baseline gap-2.5 rounded-sm-t border border-os-border bg-os-bg px-3 py-2 font-mono text-[11px]"
                >
                  <span className={`shrink-0 font-bold ${r.ok ? 'text-os-ok' : 'text-os-err'}`}>
                    {r.ok ? 'OK' : 'HATA'}
                  </span>
                  <span className="shrink-0 text-os-muted">{r.agentId}</span>
                  <span className="min-w-0 flex-1 truncate text-os-dim">{r.summary}</span>
                  <span className="shrink-0 text-os-dim">{relativeTime(r.finishedAt)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 border-t border-os-border pt-2 font-mono text-[10.5px] text-os-dim">
            Bugün {runsToday.length} çalışma kaydedildi.
          </div>
        </section>

        {/* Ajan Durumu */}
        <section className="rounded-lg-t border border-os-border bg-os-surface p-4">
          <SectionHead label="Ajan durumu" count={`${activeAgents} aktif / ${agents.length} toplam`} link="Tüm ajanlar" href="/agents" />
          {agents.length === 0 ? (
            <p className="text-[12px] text-os-dim">Kayıtlı ajan yok.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {agents.slice(0, 6).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2.5 rounded-sm-t border border-os-border bg-os-bg px-3 py-[7px]"
                >
                  <Dot state={a.status} pulse={a.status === 'active'} />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{a.name}</span>
                  <span
                    className={`shrink-0 font-mono text-[10px] uppercase tracking-wide ${
                      a.status === 'active' ? 'text-os-accent' : 'text-os-dim'
                    }`}
                  >
                    {a.status === 'active' ? 'çalışıyor' : a.status === 'planned' ? 'kimlik bekliyor' : a.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 max-[1100px]:grid-cols-1">
        {/* Bağlantılar / Connector Durumu */}
        <section className="rounded-lg-t border border-os-border bg-os-surface p-4">
          <SectionHead label="Bağlantılar" count={`${connected}/${connections.length}`} link="Tüm bağlantılar" href="/integrations" />
          <div className="grid grid-cols-2 gap-2">
            {connections.slice(0, 8).map((c: ConnectorStatus) => (
              <Link
                key={c.id}
                href="/integrations"
                className="hoverable flex min-w-0 items-center gap-[9px] rounded-sm-t border border-os-border bg-os-bg px-3 py-[7px]"
              >
                <Dot state={c.state} pulse={c.state === 'connected'} />
                <span className="flex-1 truncate text-[12px] font-medium">{c.name}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Son Raporlar */}
        <section className="rounded-lg-t border border-os-border bg-os-surface p-4">
          <SectionHead label="Son rapor" link="Tüm raporlar" href="/monitoring" />
          <p className="text-[12.5px] leading-relaxed text-os-muted">{latestReport.summary}</p>
          {latestReport.recentFailures.length > 0 && (
            <ul className="mt-2.5 flex flex-col gap-1 font-mono text-[10.5px] text-os-dim">
              {latestReport.recentFailures.slice(0, 3).map((f, i) => (
                <li key={i} className="truncate">
                  {f.agentId} — {f.summary}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
