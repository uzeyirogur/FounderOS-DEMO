/**
 * Idea Lab scoring. The schema (IdeaSchema) lives in lib/schemas.ts alongside
 * every other repo-backed entity; re-exported here so callers can import both
 * the type and the scorer from one place.
 */
export { IdeaSchema, IdeaStatusSchema, type Idea, type IdeaStatus } from '@/lib/schemas';

/** Weights sum to 1.0; market size and strategic fit matter slightly more than
 *  raw ease of build (a great-fit idea worth building is still worth building
 *  even if it takes longer). Documented here, not buried in a magic number. */
const WEIGHTS = { marketSize: 0.4, effort: 0.3, strategicFit: 0.3 } as const;

/** Weighted score out of 5, one decimal of real precision. Every factor is
 *  already scaled 1..5 with "higher is better", so this is a plain weighted sum —
 *  no inversion, no hidden curve. */
export function scoreIdea(inputs: { marketSize: number; effort: number; strategicFit: number }): number {
  return (
    inputs.marketSize * WEIGHTS.marketSize +
    inputs.effort * WEIGHTS.effort +
    inputs.strategicFit * WEIGHTS.strategicFit
  );
}
