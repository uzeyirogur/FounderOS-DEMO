import { describe, it, expect, afterEach, vi } from 'vitest';
import { ankaAdminStatus, fetchAnkaDashboard, fetchAnkaBranches, fetchAnkaSports } from '@/lib/connectors/anka-admin';

/**
 * ANKA Operations' connector into the ANKA+/TIVARO backend's dedicated
 * service-account surface (D-169 in that repo: /api/v1/service/operations/*,
 * authenticated via X-Anka-Service-Key -- NOT a JWT bearer, NOT the anka_dev
 * seed superadmin). Read-only, non-financial (D-134 in that repo's CLAUDE.md
 * applies here too).
 */
describe('ankaAdminStatus', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('is not_configured without a base URL and token', async () => {
    const status = await ankaAdminStatus({});
    expect(status.state).toBe('not_configured');
    expect(status.detail).toMatch(/ANKA_ADMIN_BASE_URL/);
    expect(status.detail).toMatch(/ANKA_ADMIN_TOKEN/);
  });

  it('is connected when the dashboard probe succeeds, and sends the service-key header (not bearer)', async () => {
    let sentHeaders: HeadersInit | undefined;
    global.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      sentHeaders = init?.headers;
      return Promise.resolve({
        ok: true,
        json: async () => ({ activeStudentCount: 3, pendingApplicationCount: 1, activeGroupCount: 2, coachCount: 1, studentsBySport: [], subscriptionStates: [] }),
      });
    }) as unknown as typeof fetch;

    const status = await ankaAdminStatus({ ANKA_ADMIN_BASE_URL: 'http://localhost:5265', ANKA_ADMIN_TOKEN: 'tok' });

    expect(status.state).toBe('connected');
    expect((sentHeaders as Record<string, string>)['X-Anka-Service-Key']).toBe('tok');
    expect((sentHeaders as Record<string, string>)['Authorization']).toBeUndefined();
  });

  it('is an error when the backend rejects the key', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;
    const status = await ankaAdminStatus({ ANKA_ADMIN_BASE_URL: 'http://localhost:5265', ANKA_ADMIN_TOKEN: 'bad' });
    expect(status.state).toBe('error');
  });
});

describe('fetchAnkaDashboard / fetchAnkaBranches / fetchAnkaSports', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('fetchAnkaDashboard calls GET /api/v1/service/operations/dashboard with the service key', async () => {
    let calledUrl = '';
    global.fetch = vi.fn().mockImplementation((url: string) => {
      calledUrl = url;
      return Promise.resolve({ ok: true, json: async () => ({ activeStudentCount: 5, pendingApplicationCount: 0, activeGroupCount: 1, coachCount: 1, studentsBySport: [], subscriptionStates: [] }) });
    }) as unknown as typeof fetch;

    const dto = await fetchAnkaDashboard('http://localhost:5265', 'tok');

    expect(calledUrl).toBe('http://localhost:5265/api/v1/service/operations/dashboard');
    expect(dto.activeStudentCount).toBe(5);
  });

  it('fetchAnkaBranches calls GET /api/v1/service/operations/branches', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [{ id: 'b1', name: 'Ataşehir', slug: 'atasehir', isActive: true }] }) as unknown as typeof fetch;
    const branches = await fetchAnkaBranches('http://localhost:5265', 'tok');
    expect(branches).toHaveLength(1);
  });

  it('fetchAnkaSports calls GET /api/v1/service/operations/sports', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [{ id: 's1', name: 'Basketbol', code: 'basketball', isActive: true }] }) as unknown as typeof fetch;
    const sports = await fetchAnkaSports('http://localhost:5265', 'tok');
    expect(sports).toHaveLength(1);
  });

  it('throws with the HTTP status when a fetch is rejected', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;
    await expect(fetchAnkaDashboard('http://localhost:5265', 'bad')).rejects.toThrow(/401/);
  });
});
