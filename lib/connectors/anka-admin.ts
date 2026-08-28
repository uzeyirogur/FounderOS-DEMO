import type { ConnectorStatus } from '@/lib/connectors/types';

/**
 * ANKA Operations' connector into the ANKA+/TIVARO backend.
 *
 * Uses ANKA+'s D-169 service-account surface: a dedicated, read-only route
 * group (`/api/v1/service/operations/*`) authenticated with a single
 * `X-Anka-Service-Key` header -- a completely separate auth path from
 * SuperAdmin's JWT bearer flow. It is NOT the anka_dev seed superadmin, and
 * it can never touch a financial endpoint (Coach/service-account financial
 * isolation, D-134 in that repo's CLAUDE.md, applies here too -- the
 * dashboard DTO this reads carries only counts, never amounts).
 *
 * Only three endpoints exist on that surface today, all read-only:
 * dashboard (org-wide counters), branches, sports.
 */

export interface AnkaSportDistribution {
  sportName: string;
  studentCount: number;
}

export interface AnkaSubscriptionStateCount {
  state: string;
  count: number;
}

export interface AnkaDashboard {
  activeStudentCount: number;
  pendingApplicationCount: number;
  activeGroupCount: number;
  coachCount: number;
  studentsBySport: AnkaSportDistribution[];
  subscriptionStates: AnkaSubscriptionStateCount[];
}

export interface AnkaBranch {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

export interface AnkaSport {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

function serviceUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

async function getJson<T>(baseUrl: string, token: string, path: string): Promise<T> {
  const res = await fetch(serviceUrl(baseUrl, path), {
    headers: { 'X-Anka-Service-Key': token },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export function fetchAnkaDashboard(baseUrl: string, token: string): Promise<AnkaDashboard> {
  return getJson<AnkaDashboard>(baseUrl, token, '/api/v1/service/operations/dashboard');
}

export function fetchAnkaBranches(baseUrl: string, token: string): Promise<AnkaBranch[]> {
  return getJson<AnkaBranch[]>(baseUrl, token, '/api/v1/service/operations/branches');
}

export function fetchAnkaSports(baseUrl: string, token: string): Promise<AnkaSport[]> {
  return getJson<AnkaSport[]>(baseUrl, token, '/api/v1/service/operations/sports');
}

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
    const dashboard = await fetchAnkaDashboard(baseUrl, token);
    return {
      id: 'anka-admin',
      name: 'ANKA+ / TIVARO Admin (read-only)',
      kind: 'crm',
      state: 'connected',
      detail: `Service account reachable · read-only, non-financial routes only · ${dashboard.activeStudentCount} active students.`,
      meta: {
        activeStudentCount: dashboard.activeStudentCount,
        pendingApplicationCount: dashboard.pendingApplicationCount,
        activeGroupCount: dashboard.activeGroupCount,
        coachCount: dashboard.coachCount,
      },
    };
  } catch (err) {
    return {
      id: 'anka-admin',
      name: 'ANKA+ / TIVARO Admin (read-only)',
      kind: 'crm',
      state: 'error',
      detail: `Dashboard probe failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
