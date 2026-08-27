import { describe, it, expect, afterEach, vi } from 'vitest';
import { anthropicUsageStatus } from '@/lib/connectors/anthropic-usage';

/**
 * Usage & Cost Monitor's connector. Anthropic's Admin API (usage_report /
 * cost_report) requires an Admin API key (sk-ant-admin...), a distinct and
 * more privileged credential than a normal API key — honest not_configured
 * without one, never a fake number.
 */
describe('anthropicUsageStatus', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('is not_configured without an admin key', async () => {
    const status = await anthropicUsageStatus({});
    expect(status.state).toBe('not_configured');
    expect(status.detail).toMatch(/ANTHROPIC_ADMIN_KEY/);
  });

  it('is connected when the admin key check succeeds', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) }) as unknown as typeof fetch;
    const status = await anthropicUsageStatus({ ANTHROPIC_ADMIN_KEY: 'sk-ant-admin-test' });
    expect(status.state).toBe('connected');
  });

  it('is an error when the admin key is rejected', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 }) as unknown as typeof fetch;
    const status = await anthropicUsageStatus({ ANTHROPIC_ADMIN_KEY: 'bad' });
    expect(status.state).toBe('error');
  });
});
