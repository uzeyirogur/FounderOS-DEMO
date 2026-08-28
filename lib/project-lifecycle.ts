/**
 * The standard project lifecycle every Project Registry entry can move
 * through — idea to reporting. Nothing here is hardcoded to a specific
 * project: this module is pure phase order plus a default "who is normally
 * responsible" map, consumed by the Project Lifecycle Orchestrator.
 *
 * A project does not have to visit every phase in a straight line (e.g. a
 * pure research spike may never reach `deployment_approval`), and iteration
 * is expected to loop `iteration -> implementation -> qa -> ...` rather than
 * terminate — `reporting` is the "as of now" checkpoint, not a hard end.
 */

export const PROJECT_LIFECYCLE_PHASES = [
  'idea',
  'research',
  'validation',
  'product_planning',
  'technical_planning',
  'implementation',
  'qa',
  'security',
  'ui_ux',
  'launch_readiness',
  'deployment_approval',
  'growth',
  'social',
  'monitoring',
  'iteration',
  'reporting',
] as const;

export type ProjectLifecyclePhase = (typeof PROJECT_LIFECYCLE_PHASES)[number];

/**
 * Default responsible agent per phase, by RuntimeAgent id (see
 * lib/agents/real.ts). This is a *default* — a specific task can name a
 * different agent; the orchestrator uses this map only when nothing more
 * specific is set.
 */
export const PHASE_RESPONSIBLE_AGENT: Record<ProjectLifecyclePhase, string> = {
  idea: 'idea-lab-agent',
  research: 'product-competitor-research',
  validation: 'product-competitor-research',
  product_planning: 'conductor',
  technical_planning: 'claude-code-orchestrator',
  implementation: 'claude-code-orchestrator',
  qa: 'qa-ui-review',
  security: 'security-reviewer',
  ui_ux: 'ui-ux-reviewer',
  launch_readiness: 'conductor',
  deployment_approval: 'conductor',
  growth: 'growth-marketing',
  social: 'social-content-studio',
  monitoring: 'usage-cost-monitor',
  iteration: 'conductor',
  reporting: 'executive-reporter',
};

export function phaseIndex(phase: ProjectLifecyclePhase): number {
  return PROJECT_LIFECYCLE_PHASES.indexOf(phase);
}

export function nextPhase(phase: ProjectLifecyclePhase): ProjectLifecyclePhase | null {
  const i = phaseIndex(phase);
  return i >= 0 && i < PROJECT_LIFECYCLE_PHASES.length - 1 ? PROJECT_LIFECYCLE_PHASES[i + 1] : null;
}

export function previousPhase(phase: ProjectLifecyclePhase): ProjectLifecyclePhase | null {
  const i = phaseIndex(phase);
  return i > 0 ? PROJECT_LIFECYCLE_PHASES[i - 1] : null;
}

export function isFirstPhase(phase: ProjectLifecyclePhase): boolean {
  return phaseIndex(phase) === 0;
}

export function isLastPhase(phase: ProjectLifecyclePhase): boolean {
  return phaseIndex(phase) === PROJECT_LIFECYCLE_PHASES.length - 1;
}

/**
 * The kind of REAL evidence required to leave a phase — not a label an
 * agent can self-report as "done". null means the phase has nothing
 * objectively checkable yet (idea/research/validation/planning phases
 * are judgment calls, not measurements). A phase requiring evidence
 * cannot advance without a matching LifecycleEvidence row recorded
 * against it — see lib/project-lifecycle-orchestrator.ts's advancePhase().
 */
export type PhaseEvidenceKind =
  | 'build_test'
  | 'qa_report'
  | 'security_report'
  | 'ui_ux_report'
  | 'launch_checklist';

export const PHASE_EXIT_EVIDENCE: Record<ProjectLifecyclePhase, PhaseEvidenceKind | null> = {
  idea: null,
  research: null,
  validation: null,
  product_planning: null,
  technical_planning: null,
  implementation: 'build_test',
  qa: 'qa_report',
  security: 'security_report',
  ui_ux: 'ui_ux_report',
  launch_readiness: 'launch_checklist',
  deployment_approval: null,
  growth: null,
  social: null,
  monitoring: null,
  iteration: null,
  reporting: null,
};
