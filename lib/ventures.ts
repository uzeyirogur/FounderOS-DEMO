/**
 * Two active income sources — the venture lens over the OS.
 *
 * One database, one G-Brain, one agent roster: ventures never partition the
 * data. They are saved filters — each one names the agents that serve it per
 * life area, the brain tag that marks its pages, and the current executive
 * focus. Switching venture in the hierarchy or life map swaps which crew
 * lights up; the agents themselves keep full visibility of everything.
 *
 * Labels/colors are deliberately neutral business-type descriptors, not a
 * brand identity — the named brands a prior operator used here (see
 * lib/agents/real.ts sales-agent) were removed 2026-08-28 as demo data.
 * `id`/`brainTag` stay as `vantage`/`launchpad-cohort` because the funnel
 * schema (FunnelVentureSchema), seeded funnel/finance rows, and G-Brain tags
 * already key off them — renaming the id would be a breaking schema change,
 * not a UI cleanup. The operator names their own ventures whenever real ones
 * replace these two rows.
 */
import type { LifeArea } from '@/lib/life-map';
import { LIFE_AREAS } from '@/lib/life-map';

export type Venture = {
  id: string;
  label: string;
  kind: string;
  color: string;
  detail: string;
  /** Tag that marks this venture's pages inside the single shared G-Brain. */
  brainTag: string;
  /** Current executive priorities — edit freely, this is the operator's list. */
  focus: string[];
  /** life-area id → the agents working that area FOR this venture. */
  areaAgents: Record<string, string[]>;
};

const SHARED_OPS = ['conductor', 'stack-monitor'];
const SHARED_KNOWLEDGE = ['data-agent', 'markdown-auditor', 'vector-auditor'];

export const VENTURES: Venture[] = [
  {
    id: 'vantage',
    label: 'Client Services',
    kind: 'AI agency',
    // Neutral slate-blue — no brand identity, see file header.
    color: '#5b8def',
    detail: 'Client AI builds and delivery — the agency arm.',
    brainTag: 'vantage',
    focus: [
      'Active client builds shipped on schedule',
      'Pipeline: proposals out, deals advanced in CRM',
      'Delivery quality — every handoff documented in G-Brain',
    ],
    areaAgents: {
      marketing: ['social-agent', 'dmflow-mcp'],
      sales: ['sales-agent', 'sales-calls-data'],
      communication: ['comms-agent', 'gmail-worker', 'slack-worker'],
      finances: ['payments-pulse', 'stripe-sales', 'processor-confirmation'],
      knowledge: [...SHARED_KNOWLEDGE, 'notion-sync'],
      operations: SHARED_OPS,
    },
  },
  {
    id: 'launchpad-cohort',
    label: 'Mentorship Program',
    kind: 'Mentorship program',
    // Neutral amber — no brand identity, see file header.
    color: '#d9a441',
    detail: 'The mentorship — students, curriculum, community.',
    brainTag: 'launchpad-cohort',
    focus: [
      'Student results — track wins, unblock stuck students fast',
      'Content + newsletter cadence for enrollment',
      'Community pulse on WhatsApp; T1 response times hold',
    ],
    areaAgents: {
      marketing: ['social-agent', 'dmflow-mcp'],
      sales: ['sales-agent', 'sales-calls-data'],
      communication: ['whatsapp-worker', 'gmail-worker', 'comms-agent'],
      finances: ['payments-pulse', 'stripe-sales', 'processor-confirmation'],
      knowledge: SHARED_KNOWLEDGE,
      operations: SHARED_OPS,
    },
  },
];

export function getVenture(id: string): Venture | null {
  return VENTURES.find((v) => v.id === id) ?? null;
}

/** Every agent serving a venture, across all its life areas. */
export function ventureAgentSet(ventureId: string): Set<string> {
  const v = getVenture(ventureId);
  return new Set(v ? Object.values(v.areaAgents).flat() : []);
}

/** Which ventures an agent works for (shared infra agents serve all). */
export function venturesForAgent(agentId: string): Venture[] {
  return VENTURES.filter((v) => ventureAgentSet(v.id).has(agentId));
}

/** Agents on one life area for one venture (the click-through Alex described). */
export function ventureAreaAgents(ventureId: string, areaId: string): string[] {
  return getVenture(ventureId)?.areaAgents[areaId] ?? [];
}

export function lifeAreaById(areaId: string): LifeArea | null {
  return LIFE_AREAS.find((a) => a.id === areaId) ?? null;
}
