import { describe, it, expect, afterEach, vi } from 'vitest';
import { ankaAdminStatus } from '@/lib/connectors/anka-admin';

/**
 * ANKA Operations' connector into the ANKA+/TIVARO backend Admin API.
 * Alex decided this needs a SEPARATE read-only service account (not the
 * anka_dev seed superadmin) — that account does not exist yet, so this stays
 * honestly not_configured until it is provisioned on the ANKA+ side (a change
 * to that repo, following its own product-owner -> architect -> ... -> review
 * workflow per its CLAUDE.md, D-134 financial isolation applies there too).
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

  it('is connected when the health check succeeds', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'Healthy' }) }) as unknown as typeof fetch;
    const status = await ankaAdminStatus({ ANKA_ADMIN_BASE_URL: 'http://localhost:5000', ANKA_ADMIN_TOKEN: 'tok' });
    expect(status.state).toBe('connected');
  });

  it('is an error when the backend rejects the token', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;
    const status = await ankaAdminStatus({ ANKA_ADMIN_BASE_URL: 'http://localhost:5000', ANKA_ADMIN_TOKEN: 'bad' });
    expect(status.state).toBe('error');
  });
});
