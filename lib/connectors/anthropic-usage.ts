import type { ConnectorStatus } from '@/lib/connectors/types';

/**
 * Usage & Cost Monitor's connector: Anthropic's Admin API usage_report. This
 * requires an ADMIN key (sk-ant-admin...), which is a distinct, more
 * privileged credential than a normal Claude API key and must be created
 * separately in the Anthropic Console (Settings -> Admin API keys). Honest
 * not_configured without one — never a fabricated cost number.
 */
export async function anthropicUsageStatus(
  env: Record<string, string | undefined> = process.env,
): Promise<ConnectorStatus> {
  const key = env.ANTHROPIC_ADMIN_KEY;
  if (!key) {
    return {
      id: 'anthropic-usage',
      name: 'Anthropic Usage (Admin API)',
      kind: 'orchestration',
      state: 'not_configured',
      detail:
        'ANTHROPIC_ADMIN_KEY not set. Create an Admin API key in the Anthropic Console (Settings -> Admin API keys, ' +
        'a separate credential from your normal API key) and set it in .env.local to enable cost/usage tracking.',
    };
  }
  try {
    const res = await fetch('https://api.anthropic.com/v1/organizations/usage_report/messages?limit=1', {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await res.json();
    return {
      id: 'anthropic-usage',
      name: 'Anthropic Usage (Admin API)',
      kind: 'orchestration',
      state: 'connected',
      detail: 'Admin key valid — usage/cost reports reachable.',
    };
  } catch (err) {
    return {
      id: 'anthropic-usage',
      name: 'Anthropic Usage (Admin API)',
      kind: 'orchestration',
      state: 'error',
      detail: `Admin key check failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
