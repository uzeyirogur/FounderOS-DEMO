import { describe, it, expect, afterEach, vi } from 'vitest';
import { webSearchStatus } from '@/lib/connectors/web-search';

/**
 * Product & Competitor Research's web search connector. Search APIs
 * (Brave Search, SerpAPI) all require a paid/free-tier key — honest
 * not_configured without one, never a fake result set.
 */
describe('webSearchStatus', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('is not_configured without a key', async () => {
    const status = await webSearchStatus({});
    expect(status.state).toBe('not_configured');
    expect(status.detail).toMatch(/BRAVE_SEARCH_API_KEY/);
  });

  it('is connected when the Brave key check succeeds', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ web: { results: [] } }) }) as unknown as typeof fetch;
    const status = await webSearchStatus({ BRAVE_SEARCH_API_KEY: 'test-key' });
    expect(status.state).toBe('connected');
  });

  it('is an error when the key is rejected', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;
    const status = await webSearchStatus({ BRAVE_SEARCH_API_KEY: 'bad' });
    expect(status.state).toBe('error');
  });
});
