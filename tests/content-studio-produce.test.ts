import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openDb } from '@/lib/db';
import { produceContentPiece } from '@/lib/content-studio';

/**
 * produceContentPiece(db, { kind, brief, projectId }, deps) — the real
 * production flow, not just "write text and call it done":
 *  1. text-native kinds (social_post, carousel) call the injected LLM chat
 *     function directly and store the result as 'produced'
 *  2. media kinds check the Capability Registry for an ACTIVE provider
 *     matching CONTENT_KIND_REQUIREMENT[kind].capability
 *     - if one exists: (today) records it as produced with a note pointing
 *       at which provider would be used — real tool invocation happens via
 *       that provider's own connector once one is actually approved+active
 *     - if none exists: runs discoverCapabilityLive to search for options,
 *       and returns status 'needs_capability' with a pointer to the
 *       Capability Registry so the operator can review/approve
 * deps (chat fn, discovery fn) are injected so this has zero network
 * dependency in tests.
 */
describe('produceContentPiece', () => {
  let db: ReturnType<typeof openDb>;
  beforeEach(() => { db = openDb(':memory:'); });
  afterEach(() => { (db as any).close?.(); });

  it('produces a social_post directly via the injected LLM chat function', async () => {
    const chat = vi.fn().mockResolvedValue({ text: 'Check out our new feature!', toolCalls: [] });
    const piece = await produceContentPiece(
      db,
      { kind: 'social_post', brief: 'Announce the new feature', projectId: null },
      { chat, discover: vi.fn() },
    );
    expect(piece.status).toBe('produced');
    expect(piece.output).toBe('Check out our new feature!');
    expect(chat).toHaveBeenCalledOnce();
    const stored = db.contentPieces.byId(piece.id);
    expect(stored?.status).toBe('produced');
  });

  it('produces a carousel directly via the injected LLM chat function', async () => {
    const chat = vi.fn().mockResolvedValue({ text: 'Slide 1: ...\nSlide 2: ...', toolCalls: [] });
    const piece = await produceContentPiece(
      db,
      { kind: 'carousel', brief: '5-slide carousel about our roadmap', projectId: null },
      { chat, discover: vi.fn() },
    );
    expect(piece.status).toBe('produced');
    expect(chat).toHaveBeenCalledOnce();
  });

  it('a media kind with an ACTIVE capability is marked produced, naming the provider', async () => {
    db.capabilities.insert({
      id: 'video-generation__runwayml.com',
      name: 'Runway Gen-4',
      capability: 'video-generation',
      type: 'hosted_service',
      connector: 'https://runwayml.com',
      authRequired: true,
      costModel: 'paid',
      freeTier: null,
      status: 'active',
      installed: true,
      configured: true,
      approvedByUser: true,
      allowedAgents: ['social-content-studio'],
      notes: null,
      lastVerifiedAt: null,
    });
    const chat = vi.fn();
    const discover = vi.fn();
    const piece = await produceContentPiece(
      db,
      { kind: 'product_demo_video', brief: 'A 20s demo of the new dashboard', projectId: null },
      { chat, discover },
    );
    expect(piece.status).toBe('produced');
    expect(piece.output).toMatch(/Runway Gen-4/);
    expect(discover).not.toHaveBeenCalled();
    expect(chat).not.toHaveBeenCalled();
  });

  it('a media kind with NO active capability runs discovery and returns needs_capability', async () => {
    const discover = vi.fn().mockResolvedValue({
      readyNow: false,
      active: [],
      candidates: [{ id: 'x', name: 'Runway Gen-4', capability: 'video-generation' }],
    });
    const piece = await produceContentPiece(
      db,
      { kind: 'product_demo_video', brief: 'A 20s demo', projectId: null },
      { chat: vi.fn(), discover },
    );
    expect(piece.status).toBe('needs_capability');
    expect(piece.requiredCapability).toBe('video-generation');
    expect(discover).toHaveBeenCalledWith(db, 'video-generation', expect.any(String));
    const stored = db.contentPieces.byId(piece.id);
    expect(stored?.status).toBe('needs_capability');
  });

  it('a failed LLM call is recorded as failed, not silently dropped', async () => {
    const chat = vi.fn().mockRejectedValue(new Error('AI_GATEWAY_API_KEY not set'));
    const piece = await produceContentPiece(
      db,
      { kind: 'social_post', brief: 'x', projectId: null },
      { chat, discover: vi.fn() },
    );
    expect(piece.status).toBe('failed');
    expect(piece.output).toMatch(/AI_GATEWAY_API_KEY/);
  });

  it('ties a piece to a project when projectId is given', async () => {
    const chat = vi.fn().mockResolvedValue({ text: 'x', toolCalls: [] });
    const piece = await produceContentPiece(
      db,
      { kind: 'social_post', brief: 'x', projectId: 'anka-tivaro' },
      { chat, discover: vi.fn() },
    );
    expect(piece.projectId).toBe('anka-tivaro');
    expect(db.contentPieces.byProjectId('anka-tivaro')).toHaveLength(1);
  });
});
