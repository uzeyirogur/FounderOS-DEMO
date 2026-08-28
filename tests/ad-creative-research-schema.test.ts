import { describe, it, expect } from 'vitest';
import { CreativeBriefSchema, CreativeFormatSchema } from '@/lib/schemas';

/**
 * Ad/Creative Research's real output: a project-tied brief that Social
 * Content Studio can consume directly — researches competitor creatives
 * and current formats, then recommends which format fits which
 * platform/product type, backed by real sources (never invented).
 */
describe('CreativeBriefSchema', () => {
  it('accepts a well-formed brief', () => {
    const brief = CreativeBriefSchema.parse({
      id: 'cb1',
      projectId: 'proj1',
      format: 'short_video',
      query: 'best short-form ad creative formats for B2C mobile apps 2026',
      recommendation: 'Vertical 9:16, hook in first 2s, captions burned in.',
      sources: [{ title: 'Example', url: 'https://example.com' }],
      createdAt: new Date().toISOString(),
    });
    expect(brief.format).toBe('short_video');
  });

  it('rejects an unknown format', () => {
    expect(() =>
      CreativeFormatSchema.parse('interpretive_dance'),
    ).toThrow();
  });

  it('accepts every real format the spec calls for', () => {
    for (const f of ['social_post', 'carousel', 'short_video', 'static_ad', 'landing_page', 'demo_video']) {
      expect(() => CreativeFormatSchema.parse(f)).not.toThrow();
    }
  });
});
