import { getDb } from '@/lib/data';
import { PageHeader } from '@/components/PageHeader';
import { Badge, SectionHead } from '@/components/terminal';

export const dynamic = 'force-dynamic';

const SOURCE_LABEL: Record<string, string> = {
  api_route: 'API rotası',
  scheduler: 'Zamanlayıcı',
  client: 'Tarayıcı',
  server_unhandled: 'Yakalanmamış (sunucu)',
};

/**
 * Real production error log view — item 9 of the go-live sprint
 * (monitoring + basic error logging). Reads the SAME error_logs table
 * lib/monitoring.ts's captureError writes to (API route failures,
 * scheduler tick failures, uncaught process exceptions, and client-side
 * React errors via ClientErrorReporter). An empty list here genuinely
 * means nothing has been captured — never a fabricated "all clear".
 */
export default function MonitoringPage() {
  const logs = getDb().errorLogs.recent(200);

  return (
    <div>
      <PageHeader eyebrow="operasyonlar" title="İzleme" caret right={<Badge tone={logs.length === 0 ? 'ok' : 'err'}>{logs.length} hata</Badge>} />
      <p className="mb-4 max-w-[720px] text-[12.5px] leading-relaxed text-os-muted">
        Uygulama genelinde yakalanan gerçek hatalar: API rotası hataları, zamanlayıcı tetiklenme hataları,
        yakalanmamış sunucu istisnaları ve tarayıcı tarafı React render hataları. Bu, {' '}
        <code className="text-os-text">GET /api/errors</code> uç noktasının okuduğu aynı kaynaktır — burada
        hiçbir şey uydurma değildir.
      </p>

      <SectionHead label="Son hatalar" count={logs.length} />
      {logs.length === 0 ? (
        <p className="text-[12px] text-os-dim">Henüz hata yakalanmadı.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {logs.map((l) => (
            <div key={l.id} className="rounded-sm-t border border-os-err/40 bg-os-err/5 px-3 py-2 font-mono text-[11px]">
              <div className="flex items-center gap-2">
                <span className="shrink-0 font-semibold text-os-err">{SOURCE_LABEL[l.source] ?? l.source}</span>
                <span className="shrink-0 text-os-dim">{l.context}</span>
                <span className="ml-auto shrink-0 text-os-dim">{l.createdAt}</span>
              </div>
              <div className="mt-1 text-os-text">{l.message}</div>
              {l.stack && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-os-dim">yığın izi</summary>
                  <pre className="mt-1 max-h-[200px] overflow-auto whitespace-pre-wrap text-[10px] text-os-dim">{l.stack}</pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
