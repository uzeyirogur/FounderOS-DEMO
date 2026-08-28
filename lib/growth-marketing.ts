import { randomUUID } from 'node:crypto';
import type { openDb } from '@/lib/db';
import type { GrowthBrief, GrowthFocus } from '@/lib/schemas';
import type { WebSearchResult } from '@/lib/connectors/web-search';

type Db = ReturnType<typeof openDb>;

export type SearchFn = (query: string) => Promise<WebSearchResult[]>;

export interface RunGrowthResearchInput {
  projectId: string;
  focus: GrowthFocus;
  query: string;
}

/**
 * Growth & Marketing's real research step: target audience, positioning,
 * competitor, channel, acquisition, SEO, campaign, funnel, landing page,
 * conversion — all backed by a real web search (injected searchFn), never
 * an invented opinion. Findings are a plain digest of what was actually
 * returned; sources are the real result URLs, kept for audit. A search
 * failure propagates (never silently swallowed into a fabricated brief).
 */
export async function runGrowthResearch(
  db: Db,
  input: RunGrowthResearchInput,
  searchFn: SearchFn,
): Promise<GrowthBrief> {
  const results = await searchFn(input.query);

  const findings =
    results.length === 0
      ? `No results found for "${input.query}".`
      : results.map((r) => `${r.title}: ${r.description || '(no description)'}`).join('\n');

  const brief: GrowthBrief = {
    id: randomUUID(),
    projectId: input.projectId,
    focus: input.focus,
    query: input.query,
    findings,
    sources: results.map((r) => ({ title: r.title, url: r.url })),
    createdAt: new Date().toISOString(),
  };

  db.growthBriefs.insert(brief);
  return brief;
}

/**
 * runGrowthResearch wired to the real Brave Search connector. Honest
 * not_configured (via a thrown error naming the missing key) when
 * BRAVE_SEARCH_API_KEY is unset — never a silent fabricated brief.
 */
export async function runGrowthResearchLive(db: Db, input: RunGrowthResearchInput): Promise<GrowthBrief> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) {
    throw new Error('BRAVE_SEARCH_API_KEY not set — set it in .env.local to let Growth & Marketing research the web.');
  }
  const { braveSearch } = await import('@/lib/connectors/web-search');
  return runGrowthResearch(db, input, (q) => braveSearch(q, key, 6));
}
