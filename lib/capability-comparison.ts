import type { CapabilityProvider, CapabilityType } from '@/lib/schemas';

/**
 * AI Intelligence's real, transparent comparison of discovered candidates
 * — every score traces to a real CapabilityProvider field (never invented
 * data). Scores the exact axes the overnight plan calls out that this
 * repo's schema can actually answer today: cost/free-tier, credential
 * requirement, and automation suitability (an MCP server or CLI is more
 * directly automatable than a hosted service requiring manual clicks).
 * Quality/API-availability/license/local-vs-cloud/integration-complexity
 * are NOT scored here because CapabilityProvider has no field for them
 * yet — adding those would mean inventing data, which the honesty rule
 * this codebase enforces everywhere else forbids.
 */
export interface CandidateComparison {
  id: string;
  name: string;
  capability: string;
  type: CapabilityType;
  costModel: CapabilityProvider['costModel'];
  freeTier: string | null;
  authRequired: boolean;
  score: number;
  scoreBreakdown: { cost: number; credential: number; automationSuitability: number };
}

const COST_SCORE: Record<CapabilityProvider['costModel'], number> = {
  free: 3,
  freemium: 2,
  paid: 0,
  unknown: 1,
};

const AUTOMATION_SUITABILITY: Record<CapabilityType, number> = {
  mcp_server: 3,
  cli: 3,
  sdk: 2,
  api: 2,
  skill: 2,
  local_model: 2,
  browser_automation: 1,
  hosted_service: 1,
  github_repo: 1,
  media_generation: 1,
  animation_library: 2,
  design_tool: 1,
};

/**
 * Scores and ranks candidates, best first, capped at the top 3 — enough
 * for a human to compare without reading a wall of rows. Never throws on
 * an empty list.
 */
export function compareCandidates(candidates: CapabilityProvider[]): CandidateComparison[] {
  return candidates
    .map((c): CandidateComparison => {
      const cost = COST_SCORE[c.costModel];
      const credential = c.authRequired ? 0 : 2;
      const automationSuitability = AUTOMATION_SUITABILITY[c.type] ?? 1;
      return {
        id: c.id,
        name: c.name,
        capability: c.capability,
        type: c.type,
        costModel: c.costModel,
        freeTier: c.freeTier,
        authRequired: c.authRequired,
        score: cost + credential + automationSuitability,
        scoreBreakdown: { cost, credential, automationSuitability },
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
