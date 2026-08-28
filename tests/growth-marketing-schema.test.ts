import { describe, it, expect } from 'vitest';
import { GrowthFocusSchema, GrowthBriefSchema } from '@/lib/schemas';

/** Growth & Marketing's output: a project-agnostic brief covering exactly
 *  the areas the spec calls for — target audience, positioning, competitor,
 *  channel, acquisition, SEO, campaign, funnel, landing page, conversion. */
describe('GrowthFocusSchema / GrowthBriefSchema', () => {
  it('covers every growth focus area the spec calls for', () => {
    expect(GrowthFocusSchema.options).toEqual([
      'target_audience',
      'positioning',
      'competitor',
      'channel',
      'acquisition',
      'seo',
      'campaign',
      'funnel',
      'landing_page',
      'conversion',
    ]);
  });

  it('parses a produced brief', () => {
    const now = new Date().toISOString();
    const parsed = GrowthBriefSchema.parse({
      id: 'g1',
      projectId: 'anka-tivaro',
      focus: 'competitor',
      query: 'basketball youth athlete development app competitors Turkey',
      findings: 'Found 3 competitors...',
      sources: [{ title: 'X', url: 'https://x.example' }],
      createdAt: now,
    });
    expect(parsed.focus).toBe('competitor');
    expect(parsed.sources).toHaveLength(1);
  });

  it('projectId is required — growth briefs always tie to a real project', () => {
    expect(() =>
      GrowthBriefSchema.parse({ id: 'g1', focus: 'seo', query: 'x', findings: 'y', createdAt: new Date().toISOString() }),
    ).toThrow();
  });
});
