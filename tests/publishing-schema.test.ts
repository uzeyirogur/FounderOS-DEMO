import { describe, it, expect } from 'vitest';
import { PublishPlanSchema, PublishPlanStatusSchema, PlatformAdaptationSchema } from '@/lib/schemas';

/**
 * Social Publishing's real output: a plan naming exactly which platforms a
 * piece goes to and the per-platform adapted caption — separate from
 * Content Studio (which only produces content) and gated on approval
 * before any live posting is attempted.
 */
describe('PublishPlanSchema', () => {
  it('PublishPlanStatusSchema tracks the plan-to-live-post lifecycle', () => {
    expect(PublishPlanStatusSchema.options).toEqual(['drafted', 'pending_approval', 'approved', 'rejected', 'published', 'failed']);
  });

  it('parses a drafted plan with per-platform adaptations', () => {
    const now = new Date().toISOString();
    const parsed = PublishPlanSchema.parse({
      id: 'p1',
      projectId: null,
      contentPieceId: 'c1',
      platforms: ['instagram', 'linkedin'],
      adaptations: [
        { platform: 'instagram', caption: 'short + hashtags', truncated: false },
        { platform: 'linkedin', caption: 'longer, professional tone', truncated: false },
      ],
      status: 'drafted',
      createdAt: now,
      decidedAt: null,
      decidedBy: null,
      publishedAt: null,
      failureReason: null,
    });
    expect(parsed.adaptations).toHaveLength(2);
  });

  it('PlatformAdaptationSchema requires a platform and caption', () => {
    expect(() => PlatformAdaptationSchema.parse({ platform: 'instagram' })).toThrow();
  });
});
