import { createGBrainProvider } from '@/lib/connectors/gbrain';
import { foldersToClusters } from '@/lib/brain-viz';
import { getDb } from '@/lib/data';
import { PageHeader } from '@/components/PageHeader';
import { BrainCore } from '@/components/BrainCore';
import { PillarRadar } from '@/components/PillarRadar';
import { pillarRadarAxes } from '@/lib/pillar-radar';
import { Dot, SectionHead } from '@/components/terminal';

export const dynamic = 'force-dynamic';

const CHECK_DOT: Record<string, string> = {
  ok: 'ok',
  warn: 'warn',
  error: 'err',
};

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return iso;
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'az önce';
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  return `${Math.floor(hours / 24)} gün önce`;
}

function Stage({
  step,
  title,
  caption,
  children,
}: {
  step: string;
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex-1 rounded-lg-t border border-os-border bg-os-surface p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm-t bg-os-accent font-mono text-xs font-bold text-os-ink">
          {step}
        </span>
        <div>
          <h2 className="text-sm font-bold">{title}</h2>
          <div className="font-mono text-[10.5px] text-os-dim">{caption}</div>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Arrow({ label }: { label: string }) {
  return (
    <div className="flex shrink-0 items-center justify-center self-stretch px-1 py-2 xl:flex-col">
      <div className="flex items-center gap-1 xl:flex-col">
        <span className="hidden h-px w-6 bg-os-border-strong xl:block xl:h-6 xl:w-px" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-os-dim xl:[writing-mode:vertical-rl]">
          {label}
        </span>
        <span className="text-os-muted xl:rotate-90">→</span>
      </div>
    </div>
  );
}

function FlowStep({ title, detail, dashed = false }: { title: string; detail: string; dashed?: boolean }) {
  return (
    <div
      className={`flex-1 rounded-md-t border px-3 py-2.5 ${
        dashed ? 'border-dashed border-os-border' : 'border-os-border bg-os-surface2'
      }`}
    >
      <div className="text-xs font-semibold">{title}</div>
      <div className="mt-0.5 text-[11px] leading-relaxed text-os-dim">{detail}</div>
    </div>
  );
}

// funnel; cached per process so a hot page doesn't hammer the API.


// over the full note set) — too heavy to redo per request on a force-dynamic page, so
// cache per server process with a short TTL. Never throws: an unreadable
// store yields undefined and the graph falls back to the plain Alex dot.


export default async function DoctorPage() {
  const overview = await createGBrainProvider().overview();
  const { store, doctor } = overview;
  const db = getDb();
  const maxFiles = Math.max(1, ...store.folders.map((f) => f.files));
  const clusters = foldersToClusters(store.folders);
  const storeShort = store.path.replace(process.env.HOME ?? '', '~');

  const lastBrainRun = db.agentRuns.byAgent('data-agent')[0];
  // latest run per agent (oldest first so the LAST write per id is the newest)
  const runsByAgent = Object.fromEntries(
    db.agentRuns
      .recent(300)
      .reverse()
      .map((r) => [r.agentId, r]),
  );
  const warnings = doctor.checks.filter((c) => c.status !== 'ok');
  const supabaseCheck = doctor.checks.find((c) => /supabase|database/i.test(c.name));
  const zeroEntropyCheck = doctor.checks.find((c) => /zero|embed/i.test(c.name));
  const fallbackActive = supabaseCheck ? supabaseCheck.status !== 'ok' : !doctor.connected;

  const layers: { name: string; sub: string; val: string; state: string }[] = [
    {
      name: 'gbrain CLI',
      sub: 'v0.41 · gbrain CLI · doctor --fast',
      val: doctor.connected ? 'CANLI' : 'ERİŞİLEMİYOR',
      state: doctor.connected ? 'connected' : 'error',
    },
    {
      name: 'brain-store/',
      sub: `${storeShort} · markdown bilgi`,
      val: `${store.totalFiles} sayfa`,
      state: store.totalFiles > 0 ? 'connected' : 'available',
    },
    {
      name: 'ZeroEntropy',
      sub: 'hybrid-search embeddings · key in ~/.config/knowledge',
      val: zeroEntropyCheck ? (zeroEntropyCheck.status === 'ok' ? 'CANLI' : zeroEntropyCheck.status.toUpperCase()) : 'CANLI',
      state: zeroEntropyCheck && zeroEntropyCheck.status !== 'ok' ? 'available' : 'connected',
    },
    {
      name: 'Supabase Second Brain',
      sub: '1240 sayfa / 15k parça · ücretsiz plan boşta durakla',
      val: fallbackActive ? 'DURAKLATILDI' : 'CANLI',
      state: fallbackActive ? 'available' : 'connected',
    },
  ];

  return (
    <div>
      {/* the engine's health readouts. The graph itself owns /brain, so this
          page is purely "is the knowledge layer working". */}
      <PageHeader
        eyebrow="bilgi çekirdeği"
        title="Doktor"
        caret
      />


      {/* G-Brain knowledge core: the PILLAR SPIDER CHART on the LEFT, the
          radar/health monitor on the RIGHT — a 50/50 split of the row.
          Stacks on narrow screens. */}
      <div className="mt-5 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <div className="flex min-h-[480px] flex-col overflow-hidden rounded-lg-t border border-os-border bg-os-surface">
          <div className="flex items-start justify-between px-4 pt-3.5 font-mono text-[10px] leading-normal text-os-dim">
            <span>
              <b className="font-medium text-os-muted">sütun sağlığı</b> — canlı kadro + çalıştırmalar + SOP kapsamı
            </span>
          </div>
          <PillarRadar
            axes={pillarRadarAxes(db.departments.all(), db.agents.all(), db.sopTasks.all(), runsByAgent)}
            health={doctor.healthScore}
            warnings={warnings.length}
          />
        </div>

        <div className="brain-stage flex min-h-[480px] flex-col overflow-hidden rounded-lg-t border border-os-border">
          {/* annotations as a real header row — at half width the old absolute
              corners collided with the radar's ring labels */}
          <div className="flex items-start justify-between px-4 pt-3.5 font-mono text-[10px] leading-normal text-os-dim">
            <div className="flex flex-col gap-1">
              <span>
                <b className="font-medium text-os-muted">doktor</b> —{' '}
                {doctor.connected ? (warnings.length > 0 ? 'uyarılar' : 'sorunsuz') : 'erişilemiyor'}
              </span>
              <span>
                {lastBrainRun ? `son çalıştırma ${relativeTime(lastBrainRun.finishedAt)} · data-agent` : 'henüz ajan çalıştırması yok'}
              </span>
            </div>
            <div className="flex flex-col gap-1 text-right">
              <span>
                <b className="font-medium text-os-muted">hibrit arama</b> {doctor.connected ? 'doğrulandı' : 'düşük performans'}
              </span>
              <span>{fallbackActive ? 'yerel yedek aktif' : 'supabase erişilebilir'}</span>
            </div>
          </div>
          <div className="grid flex-1 place-items-center">
            <div className="w-full max-w-[540px]">
              <BrainCore clusters={clusters} health={doctor.healthScore} doctor={doctor} fallbackActive={fallbackActive} />
            </div>
          </div>
        </div>

      </div>

      {/* Core status: storage layers + doctor-health footer, full width. */}
      <div className="mt-4 flex flex-col overflow-hidden rounded-lg-t border border-os-border bg-os-surface">
        <div className="border-b border-os-border px-3.5 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-os-dim">
          Depolama katmanları
        </div>
        <div className="flex flex-1 flex-col divide-y divide-os-border">
          {layers.map((layer) => (
            <div key={layer.name} className="flex flex-1 items-center gap-3 px-3.5 py-3">
              <Dot state={layer.state} pulse={layer.state === 'connected'} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-semibold">{layer.name}</div>
                <div className="truncate font-mono text-[10px] text-os-dim">{layer.sub}</div>
              </div>
              <span
                className={`shrink-0 font-mono text-[10.5px] font-semibold ${
                  layer.state === 'connected' ? 'text-os-ok' : layer.state === 'error' ? 'text-os-err' : 'text-os-warn'
                }`}
              >
                {layer.val}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-os-border px-3.5 py-3 font-mono text-[10.5px]">
          <span className="text-os-dim">
            <b className="font-medium text-os-muted">doktor</b> — sağlık {doctor.healthScore ?? '—'}/100
          </span>
          <span className={warnings.length > 0 ? 'text-os-warn' : doctor.connected ? 'text-os-ok' : 'text-os-err'}>
            {doctor.connected ? (warnings.length > 0 ? `${warnings.length} uyarı` : 'her şey yolunda') : 'çevrimdışı'}
          </span>
        </div>
      </div>

      {/* The pipeline: where knowledge lives and how it becomes searchable */}
      <section className="mt-8">
        <SectionHead label="İşlem hattı" count={`${store.totalFiles} sayfa diskte`} />
        <div className="flex flex-col gap-2 xl:flex-row xl:items-stretch">
          <Stage step="1" title="Markdown bilgi deposu" caption={storeShort}>
            <div className="text-xs text-os-muted">
              Diskte {store.totalFiles} sayfa, düz <span className="font-semibold text-os-text">.md</span> dosyaları
              — tek doğru kaynak. <code className="font-mono text-[11px]">gbrain sync</code> git deposunu tarar ve
              değişen sayfaları yukarı gönderir.
            </div>
            <ul className="mt-3 space-y-1.5">
              {store.folders.map((folder) => (
                <li key={folder.name} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 truncate font-mono text-[11px] text-os-muted">{folder.name}</span>
                  <span
                    className="h-2 rounded-sm bg-os-accent"
                    style={{
                      width: `${Math.max(6, (folder.files / maxFiles) * 100)}%`,
                      opacity: 0.25 + 0.55 * (folder.files / maxFiles),
                    }}
                  />
                  <span className="font-mono text-[11px] text-os-dim">{folder.files}</span>
                </li>
              ))}
            </ul>
          </Stage>

          <Arrow label="senkronize · içe aktar" />

          <Stage step="2" title="gbrain CLI" caption="parçala · gömme oluştur · yönlendir — disk ile veritabanı arasındaki motor">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-3xl font-bold">{doctor.healthScore ?? '—'}</span>
              <span className="font-mono text-xs text-os-dim">/ 100 sağlık{doctor.connected ? '' : ' · CLI erişilemiyor'}</span>
            </div>
            <ul className="mt-3 space-y-1.5">
              {doctor.checks.map((check) => (
                <li key={check.name} className="flex items-start gap-2 text-[11px]">
                  <span className={`dot mt-1 ${CHECK_DOT[check.status] ?? 'err'}`} />
                  <span className="text-os-muted">
                    <span className="font-semibold text-os-text">{check.name}</span> — {check.message}
                  </span>
                </li>
              ))}
              {doctor.checks.length === 0 && (
                <li className="rounded-md-t border border-dashed border-os-border px-3 py-2 font-mono text-[11px] text-os-dim">
                  doktor çevrimdışı — {doctor.detail}
                </li>
              )}
            </ul>
            <div className="mt-3 flex flex-wrap gap-1">
              {['put', 'get', 'query', 'search', 'sync', 'import', 'export', 'doctor'].map((cmd) => (
                <span key={cmd} className="rounded-sm-t border border-os-border bg-os-surface2 px-1.5 py-0.5 font-mono text-[10px] text-os-muted">
                  {cmd}
                </span>
              ))}
            </div>
          </Stage>

          <Arrow label="göm · ekle/güncelle" />

          <Stage step="3" title="Supabase Postgres + pgvector" caption='"İkinci Beyin" · ZeroEntropy gömmeleri'>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md-t border border-os-border bg-os-surface2 px-3 py-2.5">
                <div className="font-mono text-xl font-bold">1240</div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-os-dim">sayfa · son bilinen</div>
              </div>
              <div className="rounded-md-t border border-os-border bg-os-surface2 px-3 py-2.5">
                <div className="font-mono text-xl font-bold">15k</div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-os-dim">parça · son bilinen</div>
              </div>
            </div>
            <div className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-os-muted">
              <p>
                Her sayfa parçalara ayrılır; her parça bir{' '}
                <code className="font-mono">vector</code> sütununda saklanan ZeroEntropy gömmesi alır. Postgres hem
                metni (tsvector) hem de vektörleri tutar, böylece tek bir veritabanı hem anahtar kelime hem de
                anlamsal sorguları yanıtlar.
              </p>
              <p className="text-os-dim">
                Ücretsiz plan boşta kaldığında duraklar — hibrit sorgular başarısız olduğunda Supabase panelinden
                devam ettirin. Diskteki bilgi deposu bundan bağımsız çalışmaya devam eder.
              </p>
            </div>
          </Stage>
        </div>
      </section>

      {/* How a query actually resolves */}
      <section className="mt-8">
        <SectionHead label="Sorgu akışı" />
        <p className="mb-3 text-xs text-os-dim">
          Bir ajan <code className="font-mono">gbrain query</code> çağırdığında ne olur — dürüst bir yedeğe sahip
          hibrit erişim.
        </p>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
          <FlowStep title="Soru" detail="Sizden veya bir ajan çalıştırmasından gelen doğal dil sorgusu." />
          <Arrow label="genişlet" />
          <FlowStep title="Sorgu genişletme" detail="CLI, soruyu arama varyantlarına yeniden yazar (--no-expand ile atlanabilir)." />
          <Arrow label="dağıt" />
          <div className="flex flex-1 flex-col gap-2">
            <FlowStep title="Anahtar kelime arama" detail="Parça metni üzerinde Postgres tsvector tam metin eşleşmesi." />
            <FlowStep title="Vektör arama" detail="ZeroEntropy gömmeleri üzerinde pgvector en yakın komşu araması." />
          </div>
          <Arrow label="birleştir" />
          <FlowStep title="RRF birleştirme" detail="Reciprocal-rank fusion, her iki sonuç listesini tek bir sıralamada birleştirir." />
          <Arrow label="yanıt" />
          <FlowStep title="Sıralı alıntılar" detail="Ajana döndürülen, alıntılarla birlikte en üst sıradaki sayfalar." />
        </div>
        <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-stretch">
          <FlowStep
            dashed
            title="Yedek: yerel grep"
            detail="Supabase durakladıysa veya erişilemiyorsa, FOUNDER OS markdown bilgi deposunu doğrudan tarar — daha az akıllı, sıfır kesinti."
          />
        </div>
      </section>
    </div>
  );
}
