import type { ConnectorStatus } from '@/lib/connectors/types';

/**
 * GitHub connector — backs AI Intelligence's repo/release scanning and
 * Product & Engineering's Claude Code Orchestrator status. Read-only: rate
 * limit check only, no writes. Honest not_configured without a token, never
 * a fake "connected".
 */
export type GithubRateLimit = { limit: number; remaining: number; reset: number };

export function parseGithubRateLimit(raw: unknown): GithubRateLimit | null {
  const core = (raw as { resources?: { core?: unknown } })?.resources?.core as
    | { limit?: unknown; remaining?: unknown; reset?: unknown }
    | undefined;
  if (!core || typeof core.limit !== 'number' || typeof core.remaining !== 'number' || typeof core.reset !== 'number') {
    return null;
  }
  return { limit: core.limit, remaining: core.remaining, reset: core.reset };
}

export async function githubStatus(env: Record<string, string | undefined> = process.env): Promise<ConnectorStatus> {
  const token = env.GITHUB_TOKEN;
  if (!token) {
    return {
      id: 'github',
      name: 'GitHub',
      kind: 'developer',
      state: 'not_configured',
      detail: 'GITHUB_TOKEN not set — set it in .env.local to let agents read repos, releases, and issues.',
    };
  }
  try {
    const res = await fetch('https://api.github.com/rate_limit', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const limit = parseGithubRateLimit(await res.json());
    if (!limit) throw new Error('unexpected rate_limit response shape');
    return {
      id: 'github',
      name: 'GitHub',
      kind: 'developer',
      state: 'connected',
      detail: `Token valid · ${limit.remaining}/${limit.limit} API calls remaining this hour`,
      meta: { remaining: limit.remaining, limit: limit.limit },
    };
  } catch (err) {
    return {
      id: 'github',
      name: 'GitHub',
      kind: 'developer',
      state: 'error',
      detail: `Token check failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
