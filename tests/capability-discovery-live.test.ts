import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openDb } from '@/lib/db';
import { discoverCapabilityLive } from '@/lib/capability-discovery';

vi.mock('@/lib/connectors/web-search', () => ({
  braveSearch: vi.fn(),
}));

/** discoverCapabilityLive wires discoverCapability to the real Brave Search
 *  connector, reading BRAVE_SEARCH_API_KEY the same way web-search.ts does.
 *  Kept separate from discoverCapability itself so the core flow stays
 *  network-free and testable; only this thin wrapper touches env/network. */
describe('discoverCapabilityLive', () => {
  let db: ReturnType<typeof openDb>;
  const originalKey = process.env.BRAVE_SEARCH_API_KEY;

  beforeEach(() => {
    db = openDb(':memory:');
  });

  afterEach(() => {
    (db as any).close?.();
    if (originalKey === undefined) delete process.env.BRAVE_SEARCH_API_KEY;
    else process.env.BRAVE_SEARCH_API_KEY = originalKey;
    vi.clearAllMocks();
  });

  it('surfaces not_configured honestly when no key is set, without pretending to search', async () => {
    delete process.env.BRAVE_SEARCH_API_KEY;
    const result = await discoverCapabilityLive(db, 'video-generation', 'AI video generation API');
    expect(result.readyNow).toBe(false);
    expect(result.error).toMatch(/BRAVE_SEARCH_API_KEY/);
  });

  it('calls the real braveSearch connector when a key is configured', async () => {
    process.env.BRAVE_SEARCH_API_KEY = 'test-key';
    const { braveSearch } = await import('@/lib/connectors/web-search');
    (braveSearch as any).mockResolvedValue([
      { title: 'Runway Gen-4', url: 'https://runwayml.com/gen-4', description: 'video gen, paid' },
    ]);
    const result = await discoverCapabilityLive(db, 'video-generation', 'AI video generation API');
    expect(braveSearch).toHaveBeenCalledWith('AI video generation API', 'test-key', 5);
    expect(result.candidates).toHaveLength(1);
  });
});
