import { describe, it, expect } from 'vitest';
import { CONTENT_KINDS, CONTENT_KIND_REQUIREMENT, ContentPieceSchema, ContentPieceStatusSchema } from '@/lib/schemas';

/**
 * The full content surface Social Content Studio is asked to cover — not
 * just text posts. Every kind maps to whether an LLM alone can produce it
 * (textNative) and which Capability Registry tag it needs otherwise.
 */
describe('CONTENT_KINDS / CONTENT_KIND_REQUIREMENT', () => {
  it('covers every content kind the spec calls for', () => {
    expect(CONTENT_KINDS).toEqual([
      'social_post',
      'carousel',
      'ad_creative',
      'product_demo_video',
      'motion_content',
      'short_video',
      'image',
      'mockup',
      'landing_page_creative',
      'voiceover',
      'animation',
      '3d_web_interactive',
    ]);
  });

  it('social_post and carousel are text-native (LLM alone can produce them)', () => {
    expect(CONTENT_KIND_REQUIREMENT.social_post.textNative).toBe(true);
    expect(CONTENT_KIND_REQUIREMENT.carousel.textNative).toBe(true);
  });

  it('every media kind requires a specific capability tag and is not text-native', () => {
    for (const kind of ['ad_creative', 'product_demo_video', 'motion_content', 'short_video', 'image', 'mockup', 'landing_page_creative', 'voiceover', 'animation', '3d_web_interactive'] as const) {
      expect(CONTENT_KIND_REQUIREMENT[kind].textNative).toBe(false);
      expect(CONTENT_KIND_REQUIREMENT[kind].capability).toBeTruthy();
    }
  });

  it('ContentPieceStatusSchema tracks the discovery-to-delivery lifecycle', () => {
    expect(ContentPieceStatusSchema.options).toEqual(['drafted', 'needs_capability', 'produced', 'failed']);
  });

  it('ContentPieceSchema parses a produced text piece', () => {
    const parsed = ContentPieceSchema.parse({
      id: 'c1',
      projectId: null,
      kind: 'social_post',
      brief: 'Announce the new feature',
      status: 'produced',
      output: 'Check out our new feature!',
      requiredCapability: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(parsed.status).toBe('produced');
  });
});
