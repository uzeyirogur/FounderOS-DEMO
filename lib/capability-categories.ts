/**
 * Category classification for the Capability Registry's filter UI.
 * capability.capability (schemas.ts) is deliberately free-text — "new
 * capability needs appear faster than any fixed list" — so this maps that
 * tag to a display category via keyword matching, never a hardcoded
 * per-row category field that would drift as new candidates get added.
 */
export const CAPABILITY_CATEGORIES = [
  'image', 'video', '3d', 'coding', 'research', 'social',
  'publishing', 'browser', 'audio', 'security', 'analytics', 'other',
] as const;

export type CapabilityCategory = (typeof CAPABILITY_CATEGORIES)[number];

const CATEGORY_KEYWORDS: Record<Exclude<CapabilityCategory, 'other'>, RegExp> = {
  image: /image|photo|graphic|thumbnail/,
  video: /video|motion|animation|reel/,
  '3d': /3d|webgl|mesh|render/,
  coding: /code|coding|repo|programming|dev(?!elop.*market)/,
  research: /research|search|scrape|scout|discovery/,
  social: /social|dm-automation|schedul(e|ing)/,
  publishing: /publish|distribut|post-to|cross-post/,
  browser: /browser|automation(?!.*3d)/,
  audio: /audio|voice|music|podcast/,
  security: /secret|security|vulnerab|audit/,
  analytics: /analytic|usage|metric|reporting/,
};

/** Order matters: more specific categories are checked before broader
 *  ones so e.g. 'social-scheduling' resolves to 'social' rather than the
 *  generic 'schedul' fragment matching something else first. */
const CHECK_ORDER: Exclude<CapabilityCategory, 'other'>[] = [
  'video', 'image', '3d', 'audio', 'security', 'analytics',
  'publishing', 'social', 'research', 'coding', 'browser',
];

export function categorizeCapability(tag: string): CapabilityCategory {
  const lower = tag.toLowerCase();
  for (const category of CHECK_ORDER) {
    if (CATEGORY_KEYWORDS[category].test(lower)) return category;
  }
  return 'other';
}
