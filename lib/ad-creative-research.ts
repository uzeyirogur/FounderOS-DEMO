import { randomUUID } from 'node:crypto';
import type { openDb } from '@/lib/db';
import type { CreativeBrief, CreativeFormat } from '@/lib/schemas';
import type { WebSearchResult } from '@/lib/connectors/web-search';

type Db = ReturnType<typeof openDb>;

export type SearchFn = (query: string) => Promise<WebSearchResult[]>;

export interface RunCreativeResearchInput {
  projectId: string;
  format: CreativeFormat;
  query: string;
}

/**
 * Ad/Creative Research's real research step: competitor creatives and
 * current formats, backed by a real web search (injected searchFn), never
 * an invented opinion. The "recommendation" is the actual top result's
 * title/description, not a fabricated summary — Social Content Studio
 * consumes this brief directly. A search failure propagates rather than
 * being swallowed into a fabricated brief.
 */
export async function runCreativeResearch(
  db: Db,
  input: RunCreativeResearchInput,
  searchFn: SearchFn,
): Promise<CreativeBrief> {
  const results = await searchFn(input.query);

  const recommendation =
    results.length === 0
      ? `No results found for "${input.query}" — cannot recommend a format from real sources yet.`
      : results.map((r) => `${r.title}: ${r.description || '(no description)'}`).join('\n');

  const brief: CreativeBrief = {
    id: randomUUID(),
    projectId: input.projectId,
    format: input.format,
    query: input.query,
    recommendation,
    sources: results.map((r) => ({ title: r.title, url: r.url })),
    createdAt: new Date().toISOString(),
  };

  db.creativeBriefs.insert(brief);
  return brief;
}

/**
 * runCreativeResearch wired to the real Brave Search connector. Honest
 * not_configured (via a thrown error naming the missing key) when
 * BRAVE_SEARCH_API_KEY is unset — never a silent fabricated brief.
 */
export async function runCreativeResearchLive(db: Db, input: RunCreativeResearchInput): Promise<CreativeBrief> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) {
    throw new Error('BRAVE_SEARCH_API_KEY not set — set it in .env.local to let Ad/Creative Research search the web.');
  }
  const { braveSearch } = await import('@/lib/connectors/web-search');
  return runCreativeResearch(db, input, (q) => braveSearch(q, key, 6));
}
