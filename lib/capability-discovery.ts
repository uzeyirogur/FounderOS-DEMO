import { randomUUID, createHash } from 'node:crypto';
import type { openDb } from '@/lib/db';
import type { CapabilityCostModel, CapabilityProvider } from '@/lib/schemas';
import type { WebSearchResult } from '@/lib/connectors/web-search';

type Db = ReturnType<typeof openDb>;

export type SearchFn = (query: string) => Promise<WebSearchResult[]>;

export interface DiscoverCapabilityResult {
  /** True when an ACTIVE, already-approved provider exists for this
   *  capability right now — the caller can use it immediately. */
  readyNow: boolean;
  /** Active providers found in the registry (empty unless readyNow). */
  active: CapabilityProvider[];
  /** Newly-discovered (or already-known) candidate rows for this
   *  capability, freshly persisted to the registry. */
  candidates: CapabilityProvider[];
  /** Set when the search itself failed (e.g. missing API key) — surfaced
   *  honestly rather than silently reporting zero candidates. */
  error?: string;
}

/** Turn a (capability, url) pair into a short, stable, id-safe slug so the
 *  same discovered tool is never inserted twice across repeated discovery
 *  runs for the SAME capability need — but the same URL surfacing for two
 *  different capability tags (e.g. a hosted service that does both video
 *  and audio) gets its own row per tag, never silently shared/collided. */
function idFromUrl(capability: string, url: string, fallback: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const base = host || fallback;
    return `${capability}__${base}`.toLowerCase().replace(/[^a-z0-9_.-]/g, '-').slice(0, 120);
  } catch {
    return createHash('sha1').update(`${capability}:${fallback}`).digest('hex').slice(0, 12);
  }
}

/** Very deliberately crude: this is a first-pass signal for a human to
 *  refine, not a claim of certainty. "unknown" is the honest default — a
 *  registry row that has not been read by a human should never claim to be
 *  free when it might not be. */
function guessCostModel(text: string): CapabilityCostModel {
  const lower = text.toLowerCase();
  const paidSignal = /\b(paid|subscription|pricing|\$\d|per month|\/mo\b|license fee)\b/.test(lower);
  const freeSignal = /\b(free and open source|open[- ]source|free tier|no cost|free to use)\b/.test(lower);
  if (paidSignal && !freeSignal) return 'paid';
  if (freeSignal && !paidSignal) return 'free';
  if (freeSignal && paidSignal) return 'freemium';
  return 'unknown';
}

/**
 * The shared "don't just say I can't" flow (see the Approval Policy):
 *  1. check the registry — an ACTIVE provider for this capability means the
 *     caller is done, no search needed
 *  2. otherwise run a real web search for current options (searchFn is
 *     injected so no module here talks to the network directly)
 *  3. persist each result as a 'candidate' row (deduped by a stable id
 *     derived from its URL) — status stays 'candidate', approvedByUser
 *     stays false; nothing here activates anything
 *  4. return what was found so the calling agent can present it to Alex
 *
 * A search failure (e.g. BRAVE_SEARCH_API_KEY not set) is surfaced in
 * `error`, never silently reported as "found nothing".
 */
export async function discoverCapability(
  db: Db,
  capability: string,
  searchQuery: string,
  searchFn: SearchFn,
): Promise<DiscoverCapabilityResult> {
  const existing = db.capabilities.byCapability(capability);
  const active = existing.filter((c) => c.status === 'active');
  if (active.length > 0) {
    return { readyNow: true, active, candidates: existing };
  }

  let results: WebSearchResult[];
  try {
    results = await searchFn(searchQuery);
  } catch (err) {
    return {
      readyNow: false,
      active: [],
      candidates: existing,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const candidates: CapabilityProvider[] = [];
  for (const r of results) {
    const id = idFromUrl(capability, r.url, randomUUID());
    const already = db.capabilities.byId(id);
    if (already) {
      candidates.push(already);
      continue;
    }
    const row: CapabilityProvider = {
      id,
      name: r.title,
      capability,
      type: 'hosted_service',
      connector: r.url,
      authRequired: false,
      costModel: guessCostModel(`${r.title} ${r.description}`),
      freeTier: null,
      status: 'candidate',
      installed: false,
      configured: false,
      approvedByUser: false,
      allowedAgents: [],
      notes: r.description || null,
      lastVerifiedAt: new Date().toISOString(),
    };
    db.capabilities.insert(row);
    candidates.push(row);
  }

  return { readyNow: false, active: [], candidates };
}

/**
 * discoverCapability wired to the real Brave Search connector — the path
 * every agent actually calls. Reads BRAVE_SEARCH_API_KEY the same way
 * lib/connectors/web-search.ts's own status check does; missing key
 * surfaces as an honest `error`, never a silent empty result.
 */
export async function discoverCapabilityLive(
  db: Db,
  capability: string,
  searchQuery: string,
): Promise<DiscoverCapabilityResult> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) {
    return {
      readyNow: false,
      active: [],
      candidates: db.capabilities.byCapability(capability),
      error: 'BRAVE_SEARCH_API_KEY not set — set it in .env.local to let AI Intelligence search for capabilities.',
    };
  }
  const { braveSearch } = await import('@/lib/connectors/web-search');
  return discoverCapability(db, capability, searchQuery, (q) => braveSearch(q, key, 5));
}
