import { describe, it, expect } from 'vitest';
import { CAPABILITY_CATEGORIES, categorizeCapability } from '@/lib/capability-categories';

/**
 * The overnight plan asks the Capability Registry to filter by category
 * (image/video/3D/coding/research/social/publishing/browser/audio/
 * security/analytics). capability.capability is a deliberately free-text
 * tag (schemas.ts's own comment: "new capability needs appear faster than
 * any fixed list"), so categorization is keyword-based over that tag —
 * never a hardcoded per-row category that would drift from new candidates.
 */
describe('categorizeCapability', () => {
  it('maps common real-shaped tags to the expected category', () => {
    expect(categorizeCapability('video-generation')).toBe('video');
    expect(categorizeCapability('image-generation')).toBe('image');
    expect(categorizeCapability('3d-rendering')).toBe('3d');
    expect(categorizeCapability('web-search')).toBe('research');
    expect(categorizeCapability('code-generation')).toBe('coding');
    expect(categorizeCapability('social-scheduling')).toBe('social');
    expect(categorizeCapability('publish-to-instagram')).toBe('publishing');
    expect(categorizeCapability('browser-automation')).toBe('browser');
    expect(categorizeCapability('voiceover')).toBe('audio');
    expect(categorizeCapability('secret-scanning')).toBe('security');
    expect(categorizeCapability('usage-analytics')).toBe('analytics');
  });

  it('falls back to "other" for a tag matching no known category, never throws', () => {
    expect(categorizeCapability('something-nobody-anticipated')).toBe('other');
  });

  it('CAPABILITY_CATEGORIES is the exact list the overnight plan named, plus "other"', () => {
    expect(CAPABILITY_CATEGORIES).toEqual([
      'image', 'video', '3d', 'coding', 'research', 'social',
      'publishing', 'browser', 'audio', 'security', 'analytics', 'other',
    ]);
  });
});
