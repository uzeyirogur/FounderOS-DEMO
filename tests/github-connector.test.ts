import { describe, it, expect, afterEach, vi } from 'vitest';
import { githubStatus, parseGithubRateLimit } from '@/lib/connectors/github';

/** GitHub connector: honest not_configured without a token, real API check with one. */
describe('parseGithubRateLimit', () => {
  it('reads the core rate limit block', () => {
    const body = { resources: { core: { limit: 5000, remaining: 4980, reset: 1893456000 } } };
    expect(parseGithubRateLimit(body)).toEqual({ limit: 5000, remaining: 4980, reset: 1893456000 });
  });

  it('returns null for malformed input', () => {
    expect(parseGithubRateLimit(null)).toBeNull();
    expect(parseGithubRateLimit({})).toBeNull();
  });
});

describe('githubStatus', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    vi.unstubAllEnvs();
  });

  it('is not_configured without a token', async () => {
    vi.stubEnv('GITHUB_TOKEN', '');
    const status = await githubStatus({});
    expect(status.state).toBe('not_configured');
  });

  it('is connected when the token check succeeds', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ resources: { core: { limit: 5000, remaining: 4999, reset: 1893456000 } } }),
    }) as unknown as typeof fetch;
    const status = await githubStatus({ GITHUB_TOKEN: 'ghp_test' });
    expect(status.state).toBe('connected');
    expect(status.detail).toContain('4999');
  });

  it('is an error when the token is rejected', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;
    const status = await githubStatus({ GITHUB_TOKEN: 'bad' });
    expect(status.state).toBe('error');
  });
});
