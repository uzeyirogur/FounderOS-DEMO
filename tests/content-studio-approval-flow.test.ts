import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openDb } from '@/lib/db';
import { produceContentPiece } from '@/lib/content-studio';

/**
 * The overnight/completion-sprint plan asks Social Content Studio's
 * brief -> capability requirements -> registry lookup -> missing capability
 * discovery -> candidate comparison -> approval requirement -> production
 * readiness flow to be REAL end to end. produceContentPiece already did
 * everything through discovery; this closes the last two steps:
 *  - after discovery, the top candidates are scored via compareCandidates
 *    (never a second, hand-rolled comparison)
 *  - when the top candidate needs a real credential or is paid, a real
 *    approval_request Notification row is queued (never auto-activated) so
 *    the operator sees what's needed / why / options / rough cost / free
 *    alternative — not just a bare 'needs_capability' status with no next
 *    step visible anywhere.
 */
describe('produceContentPiece — capability comparison + approval request', () => {
  let db: ReturnType<typeof openDb>;
  beforeEach(() => { db = openDb(':memory:'); });
  afterEach(() => { (db as any).close?.(); });

  it('queues a real approval_request notification naming the top candidate and its cost when nothing free is available', async () => {
    const discover = vi.fn().mockResolvedValue({
      readyNow: false,
      active: [],
      candidates: [
        {
          id: 'c-paid', name: 'Runway Gen-4', capability: 'video-generation', type: 'hosted_service',
          connector: 'https://runwayml.com', authRequired: true, costModel: 'paid', freeTier: null,
          status: 'candidate', installed: false, configured: false, approvedByUser: false,
          allowedAgents: [], notes: null, lastVerifiedAt: null,
        },
      ],
    });
    const piece = await produceContentPiece(
      db,
      { kind: 'product_demo_video', brief: 'A 20s demo of the new dashboard', projectId: null },
      { chat: vi.fn(), discover },
    );
    expect(piece.status).toBe('needs_capability');

    const pending = db.notifications.pending();
    const approval = pending.find((n) => n.kind === 'approval_request' && n.agentId === 'social-content-studio');
    expect(approval, 'expected an approval_request notification to be queued').toBeTruthy();
    expect(approval!.requiresApproval).toBe(true);
    // Names what's needed, why, and honestly says no free alternative exists.
    expect(approval!.body).toMatch(/video-generation/);
    expect(approval!.body).toMatch(/Runway Gen-4/);
    expect(approval!.body.toLowerCase()).toMatch(/no free\/no-credential alternative/);
  });

  it('names a real free/no-auth alternative when a higher-scoring freemium candidate ranks top', async () => {
    // compareCandidates scores cost + credential + automation-suitability.
    // A freemium, no-auth, mcp_server candidate (2+2+3=7) can legitimately
    // outrank a free-but-credentialed hosted_service (3+0+1=4) — that's
    // the real scenario this alternative-naming branch exists for: the
    // top pick still needs a decision (freemium), but a free path exists
    // further down the ranking and the operator should see it named.
    const discover = vi.fn().mockResolvedValue({
      readyNow: false,
      active: [],
      candidates: [
        {
          id: 'c-freemium-mcp', name: 'OpenMCP Video', capability: 'video-generation', type: 'mcp_server',
          connector: 'https://openmcp.example.com', authRequired: false, costModel: 'freemium', freeTier: '10/mo',
          status: 'candidate', installed: false, configured: false, approvedByUser: false,
          allowedAgents: [], notes: null, lastVerifiedAt: null,
        },
        {
          id: 'c-free-auth', name: 'Community Render Farm', capability: 'video-generation', type: 'hosted_service',
          connector: 'https://renderfarm.example.com', authRequired: false, costModel: 'free', freeTier: 'unlimited',
          status: 'candidate', installed: false, configured: false, approvedByUser: false,
          allowedAgents: [], notes: null, lastVerifiedAt: null,
        },
      ],
    });
    await produceContentPiece(
      db,
      { kind: 'product_demo_video', brief: 'A 20s demo', projectId: null },
      { chat: vi.fn(), discover },
    );
    const pending = db.notifications.pending();
    const approval = pending.find((n) => n.kind === 'approval_request');
    expect(approval, 'expected an approval_request for the freemium top pick').toBeTruthy();
    expect(approval!.body).toMatch(/OpenMCP Video/);
    expect(approval!.body).toMatch(/Community Render Farm/);
  });

  it('does NOT queue an approval request when the top candidate is free and needs no credential', async () => {
    const discover = vi.fn().mockResolvedValue({
      readyNow: false,
      active: [],
      candidates: [
        {
          id: 'c-free', name: 'Local Stable Video Diffusion', capability: 'video-generation', type: 'local_model',
          connector: null, authRequired: false, costModel: 'free', freeTier: 'unlimited (local)',
          status: 'candidate', installed: false, configured: false, approvedByUser: false,
          allowedAgents: [], notes: null, lastVerifiedAt: null,
        },
      ],
    });
    await produceContentPiece(
      db,
      { kind: 'product_demo_video', brief: 'A 20s demo', projectId: null },
      { chat: vi.fn(), discover },
    );
    const pending = db.notifications.pending();
    expect(pending.some((n) => n.kind === 'approval_request')).toBe(false);
  });

  it('does NOT queue an approval request when discovery finds nothing at all', async () => {
    const discover = vi.fn().mockResolvedValue({ readyNow: false, active: [], candidates: [] });
    await produceContentPiece(
      db,
      { kind: 'product_demo_video', brief: 'A 20s demo', projectId: null },
      { chat: vi.fn(), discover },
    );
    const pending = db.notifications.pending();
    expect(pending.some((n) => n.kind === 'approval_request')).toBe(false);
  });
});
