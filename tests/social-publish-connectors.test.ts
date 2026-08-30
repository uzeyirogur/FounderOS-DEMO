import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { publishToInstagramLive, instagramConfigured } from '@/lib/connectors/instagram-publish';
import { publishToXLive, xConfigured } from '@/lib/connectors/x-publish';
import { publishToLinkedInLive, linkedinConfigured } from '@/lib/connectors/linkedin-publish';

/**
 * Real official-platform publish connectors, architecture-ready for the
 * moment real credentials exist. No fake "connected" state, no simulated
 * post id — honest not_configured naming the exact missing env var when
 * credentials are absent, and a real fetch() call with the real official
 * API shape when they are present.
 */
describe('Instagram Graph API publish connector', () => {
  const prevEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...prevEnv };
    vi.unstubAllGlobals();
  });

  it('is honestly not_configured when credentials are missing', async () => {
    delete process.env.INSTAGRAM_ACCESS_TOKEN;
    delete process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
    expect(instagramConfigured()).toBe(false);
    const result = await publishToInstagramLive({ caption: 'test', imageUrl: 'https://example.com/x.jpg' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/INSTAGRAM_ACCESS_TOKEN/);
  });

  it('calls the real 2-step Graph API flow (container then publish) when configured', async () => {
    process.env.INSTAGRAM_ACCESS_TOKEN = 'fake-token';
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = '123456';
    expect(instagramConfigured()).toBe(true);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'container-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'post-1' }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await publishToInstagramLive({ caption: 'hello', imageUrl: 'https://example.com/x.jpg' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.postId).toBe('post-1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('123456/media');
    expect(fetchMock.mock.calls[1][0]).toContain('123456/media_publish');
  });

  it('surfaces a real Graph API error honestly, never fabricates success', async () => {
    process.env.INSTAGRAM_ACCESS_TOKEN = 'fake-token';
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = '123456';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: { message: 'Invalid image URL' } }) }),
    );
    const result = await publishToInstagramLive({ caption: 'hello', imageUrl: 'bad-url' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('Invalid image URL');
  });
});

describe('X API v2 publish connector', () => {
  const prevEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...prevEnv };
    vi.unstubAllGlobals();
  });

  it('is honestly not_configured and names the real 2026 pay-per-use pricing context', async () => {
    delete process.env.X_API_BEARER_TOKEN;
    expect(xConfigured()).toBe(false);
    const result = await publishToXLive({ text: 'hello' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/X_API_BEARER_TOKEN/);
      expect(result.reason).toMatch(/pay-per-use/i);
    }
  });

  it('calls the real POST /2/tweets endpoint when configured', async () => {
    process.env.X_API_BEARER_TOKEN = 'fake-token';
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: 'tweet-1' } }) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await publishToXLive({ text: 'hello' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.postId).toBe('tweet-1');
    expect(fetchMock.mock.calls[0][0]).toContain('/tweets');
  });
});

describe('LinkedIn Posts API publish connector', () => {
  const prevEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...prevEnv };
    vi.unstubAllGlobals();
  });

  it('is honestly not_configured and distinguishes member-profile from company-page scope', async () => {
    delete process.env.LINKEDIN_ACCESS_TOKEN;
    delete process.env.LINKEDIN_PERSON_URN;
    expect(linkedinConfigured()).toBe(false);
    const result = await publishToLinkedInLive({ text: 'hello' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/LINKEDIN_ACCESS_TOKEN/);
      expect(result.reason).toMatch(/w_organization_social/);
    }
  });

  it('reads the post id from the x-restli-id response header on a real 201', async () => {
    process.env.LINKEDIN_ACCESS_TOKEN = 'fake-token';
    process.env.LINKEDIN_PERSON_URN = 'urn:li:person:abc123';
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: { get: (name: string) => (name === 'x-restli-id' ? 'urn:li:share:999' : null) },
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await publishToLinkedInLive({ text: 'hello' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.postId).toBe('urn:li:share:999');
  });
});
