'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { ActivityEvent } from '@/lib/schemas';

/**
 * The live agent activity feed for the /agents page — one newest-first stream
 * of what agents actually did: runs, chat replies, and broadcast answers.
 * SSR-seeded; the refresh button re-pulls GET /api/agents/activity.
 */
const KIND: Record<ActivityEvent['kind'], { label: string; cls: string }> = {
  run: { label: 'run', cls: 'text-os-muted' },
  message: { label: 'chat', cls: 'text-os-accent' },
  broadcast: { label: 'cast', cls: 'text-os-text' },
};

function clock(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Renders `clock(at)` only after the component has mounted on the client.
 * toLocaleTimeString() with no explicit timeZone reads the RUNNING
 * environment's local timezone — the Node SSR process and the browser can
 * disagree (found live via Playwright: a real hydration mismatch on every
 * /agents load, not styling). Deferring to a post-mount effect means the
 * server always emits an empty placeholder and the client fills in the
 * real time once — no mismatch, because the server's guess is never
 * asserted as the final text.
 */
function ClientClock({ at }: { at: string }) {
  const [text, setText] = useState('');
  useEffect(() => setText(clock(at)), [at]);
  return <span className="shrink-0 text-os-dim">{text}</span>;
}

export function AgentActivityFeed({
  initialEvents,
  agentNames,
}: {
  initialEvents: ActivityEvent[];
  agentNames: Record<string, string>;
}) {
  const [events, setEvents] = useState<ActivityEvent[]>(initialEvents);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch('/api/agents/activity?limit=40');
      if (res.ok) setEvents(((await res.json()) as { events: ActivityEvent[] }).events);
    } catch {
      // keep the existing list on a transient failure
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg-t border border-os-border bg-os-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-os-dim">Activity</h2>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1.5 font-mono text-[10px] text-os-dim hover:text-os-muted disabled:opacity-50"
          aria-label="Refresh activity"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> refresh
        </button>
      </div>

      {events.length === 0 ? (
        <p className="font-mono text-[10.5px] text-os-dim">
          No activity yet — chat with an agent or the Conductor to see it here.
        </p>
      ) : (
        <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
          {events.map((e, i) => (
            <li
              key={`${e.kind}-${e.at}-${i}`}
              className="flex items-baseline gap-2 border-b border-os-border/50 pb-1 font-mono text-[10.5px] last:border-0"
            >
              <span className={`w-9 shrink-0 uppercase ${KIND[e.kind].cls}`}>{KIND[e.kind].label}</span>
              <span className="shrink-0 font-semibold text-os-text">{agentNames[e.agentId] ?? e.agentId}</span>
              {e.ok === false && <span className="shrink-0 text-os-err">FAIL</span>}
              <span className="min-w-0 flex-1 truncate text-os-muted" title={e.summary}>
                {e.summary}
              </span>
              <ClientClock at={e.at} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
