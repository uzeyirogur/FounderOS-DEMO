import type { ConnectorStatus } from '@/lib/connectors/types';

/**
 * ANKA Operations' connector into the ANKA+/TIVARO backend. Per Alex's
 * decision, this uses a SEPARATE read-only service account — never the
 * anka_dev seed superadmin, and never any endpoint touching finance
 * (Coach/service-account financial isolation, D-134 in that repo's
 * CLAUDE.md, applies here too: this connector must only ever call read-only,
 * non-financial routes once wired).
 *
 * Not configured until that service account is provisioned on the ANKA+ side
 * (a change to that repo, through its own product-owner -> architect ->
 * implementation -> qa -> security-review -> code-review workflow) and its
 * base URL + token are set here. This file intentionally does not call any
 * ANKA+ endpoint yet — status-only until the account exists.
 */
export async function ankaAdminStatus(
  env: Record<string, string | undefined> = process.env,
): Promise<ConnectorStatus> {
  const baseUrl = env.ANKA_ADMIN_BASE_URL;
  const token = env.ANKA_ADMIN_TOKEN;
  if (!baseUrl || !token) {
    return {
      id: 'anka-admin',
      name: 'ANKA+ / TIVARO Admin (read-only)',
      kind: 'crm',
      state: 'not_configured',
      detail:
        'Set ANKA_ADMIN_BASE_URL and ANKA_ADMIN_TOKEN in .env.local. Requires a dedicated read-only service ' +
        'account on the ANKA+ backend (not the anka_dev seed superadmin) — provision that first on the ANKA+ side.',
    };
  }
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/health`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await res.json();
    return {
      id: 'anka-admin',
      name: 'ANKA+ / TIVARO Admin (read-only)',
      kind: 'crm',
      state: 'connected',
      detail: 'Service account reachable · read-only, non-financial routes only.',
    };
  } catch (err) {
    return {
      id: 'anka-admin',
      name: 'ANKA+ / TIVARO Admin (read-only)',
      kind: 'crm',
      state: 'error',
      detail: `Health check failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
