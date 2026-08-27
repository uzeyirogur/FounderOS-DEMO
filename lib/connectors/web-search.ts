import type { ConnectorStatus } from '@/lib/connectors/types';

/**
 * Web search connector for Product & Competitor Research and Idea Lab
 * enrichment. Brave Search API (has a free tier, no card required for the
 * base plan) — honest not_configured without a key, never invented search
 * results.
 */
export type WebSearchResult = { title: string; url: string; description: string };

export async function braveSearch(
  query: string,
  key: string,
  limit = 5,
): Promise<WebSearchResult[]> {
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${limit}`, {
    headers: { 'X-Subscription-Token': key, Accept: 'application/json' },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { web?: { results?: unknown[] } };
  const results = Array.isArray(body.web?.results) ? body.web!.results! : [];
  return results.map((r) => {
    const item = (r ?? {}) as Record<string, unknown>;
    return {
      title: typeof item.title === 'string' ? item.title : '(untitled)',
      url: typeof item.url === 'string' ? item.url : '',
      description: typeof item.description === 'string' ? item.description : '',
    };
  });
}

export async function webSearchStatus(
  env: Record<string, string | undefined> = process.env,
): Promise<ConnectorStatus> {
  const key = env.BRAVE_SEARCH_API_KEY;
  if (!key) {
    return {
      id: 'web-search',
      name: 'Web Search (Brave)',
      kind: 'orchestration',
      state: 'not_configured',
      detail: 'BRAVE_SEARCH_API_KEY not set — set it in .env.local to let Product & Competitor Research and Idea Lab search the web.',
    };
  }
  try {
    await braveSearch('founderos test query', key, 1);
    return {
      id: 'web-search',
      name: 'Web Search (Brave)',
      kind: 'orchestration',
      state: 'connected',
      detail: 'Brave Search API key valid.',
    };
  } catch (err) {
    return {
      id: 'web-search',
      name: 'Web Search (Brave)',
      kind: 'orchestration',
      state: 'error',
      detail: `Key check failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
