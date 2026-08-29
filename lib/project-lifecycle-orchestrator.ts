import { randomUUID } from 'node:crypto';
import type { openDb } from '@/lib/db';
import {
  PHASE_RESPONSIBLE_AGENT,
  PHASE_EXIT_EVIDENCE,
  nextPhase,
  isLastPhase,
  type ProjectLifecyclePhase,
  type PhaseEvidenceKind,
} from '@/lib/project-lifecycle';
import type { LifecycleApproval, LifecycleEvidence, LifecycleTask, ProjectLifecycleState } from '@/lib/schemas';

type Db = ReturnType<typeof openDb>;

/** Phases a project may NOT leave without an approved LifecycleApproval row.
 *  Deliberately a short, explicit list rather than "any phase can gate" —
 *  today only the phase whose entire purpose is a go/no-go decision gates. */
const APPROVAL_GATED_PHASES = new Set<ProjectLifecyclePhase>(['deployment_approval']);

/**
 * Records a real evidence row for a phase — a real build/test run, a real
 * QA/security/UI-UX report, or a real launch checklist. Refuses a kind
 * that doesn't match what PHASE_EXIT_EVIDENCE requires for that phase,
 * so an agent can't manufacture a "pass" of the wrong shape.
 */
export function recordEvidence(
  db: Db,
  input: { projectId: string; phase: ProjectLifecyclePhase; kind: PhaseEvidenceKind; ok: boolean; summary: string; recordedByAgentId: string },
): LifecycleEvidence {
  const expectedKind = PHASE_EXIT_EVIDENCE[input.phase];
  if (expectedKind !== input.kind) {
    throw new Error(`recordEvidence: phase '${input.phase}' expects evidence kind '${expectedKind}', got '${input.kind}'`);
  }
  const evidence: LifecycleEvidence = {
    id: randomUUID(),
    projectId: input.projectId,
    phase: input.phase,
    kind: input.kind,
    ok: input.ok,
    summary: input.summary,
    recordedByAgentId: input.recordedByAgentId,
    recordedAt: new Date().toISOString(),
  };
  db.lifecycleEvidence.insert(evidence);
  return evidence;
}

/** True when a phase either has no evidence requirement, or has at least
 *  one recorded evidence row for it whose `ok` is true. The most recent
 *  attempt is what counts — a later pass overrides an earlier failure,
 *  so a fixed build doesn't stay permanently blocked by its first try. */
function evidenceSatisfied(db: Db, projectId: string, phase: ProjectLifecyclePhase): boolean {
  const required = PHASE_EXIT_EVIDENCE[phase];
  if (!required) return true;
  const rows = db.lifecycleEvidence.byProjectPhase(projectId, phase);
  return rows.length > 0 && rows[0].ok === true; // byProjectPhase orders newest first
}

/** Returns the project's lifecycle row, creating it at phase 'idea' with a
 *  one-entry history on first access. Idempotent: a second call for the same
 *  project returns the existing row unchanged. */
export function getOrCreateLifecycleState(db: Db, projectId: string): ProjectLifecycleState {
  const existing = db.lifecycleState.byProjectId(projectId);
  if (existing) return existing;
  const now = new Date().toISOString();
  const state: ProjectLifecycleState = {
    projectId,
    currentPhase: 'idea',
    history: [{ phase: 'idea', enteredAt: now }],
    updatedAt: now,
  };
  db.lifecycleState.upsert(state);
  return state;
}

export type AdvanceResult =
  | { ok: true; state: ProjectLifecycleState }
  | { ok: false; reason: string; state?: ProjectLifecycleState };

/**
 * Moves a project one step forward in the standard lifecycle.
 *  - refuses past the last phase ('reporting')
 *  - refuses to LEAVE a phase with an evidence requirement (implementation/
 *    qa/security/ui_ux/launch_readiness) unless the most recent recorded
 *    evidence for that phase is ok — a phase is not "done" because an
 *    agent said so
 *  - refuses to LEAVE an approval-gated phase unless its approval row is
 *    'approved' (there may be more than one gated approval historically;
 *    only the most recent counts)
 *  - entering a gated phase auto-creates a pending LifecycleApproval so the
 *    gate is never silently invisible to the operator
 */
export function advancePhase(db: Db, projectId: string, requestedByAgentId: string): AdvanceResult {
  const state = getOrCreateLifecycleState(db, projectId);

  if (isLastPhase(state.currentPhase)) {
    return { ok: false, reason: `Project is already at the last phase (${state.currentPhase}).`, state };
  }

  if (!evidenceSatisfied(db, projectId, state.currentPhase)) {
    const kind = PHASE_EXIT_EVIDENCE[state.currentPhase];
    return {
      ok: false,
      reason: `Cannot leave '${state.currentPhase}' — no passing '${kind}' evidence has been recorded for this phase yet.`,
      state,
    };
  }

  if (APPROVAL_GATED_PHASES.has(state.currentPhase)) {
    const approvals = db.lifecycleApprovals.byProjectId(projectId);
    const latestForPhase = approvals.find((a) => a.phase === state.currentPhase);
    if (!latestForPhase || latestForPhase.status !== 'approved') {
      return {
        ok: false,
        reason: `Cannot leave '${state.currentPhase}' — a pending approval must be approved first.`,
        state,
      };
    }
  }

  const next = nextPhase(state.currentPhase);
  if (!next) {
    return { ok: false, reason: `Project is already at the last phase (${state.currentPhase}).`, state };
  }

  const now = new Date().toISOString();
  const updated: ProjectLifecycleState = {
    projectId,
    currentPhase: next,
    history: [...state.history, { phase: next, enteredAt: now }],
    updatedAt: now,
  };
  db.lifecycleState.upsert(updated);

  if (APPROVAL_GATED_PHASES.has(next)) {
    db.lifecycleApprovals.insert({
      id: randomUUID(),
      projectId,
      phase: next,
      title: `Approve advancing "${projectId}" past ${next}`,
      description: `Auto-created when the project entered the ${next} phase. Approve to let it continue.`,
      requestedByAgentId,
      status: 'pending',
      createdAt: now,
      decidedAt: null,
      decidedBy: null,
      notes: null,
    });
  }

  return { ok: true, state: updated };
}

export interface ProjectLifecycleSummary {
  projectId: string;
  currentPhase: ProjectLifecyclePhase;
  responsibleAgentId: string;
  openTasks: LifecycleTask[];
  pendingApprovals: LifecycleApproval[];
  updatedAt: string;
  /** What real evidence this phase needs to leave, and whether it has it
   *  yet — null when the phase has no evidence requirement (a judgment
   *  call phase). Mirrors evidenceSatisfied()'s own logic exactly so the
   *  UI can never show "satisfied" when advancePhase would actually
   *  refuse, or vice versa. */
  requiredEvidence: { kind: PhaseEvidenceKind; satisfied: boolean; latestSummary: string | null } | null;
  /** One human-readable sentence naming the actual next step — a pending
   *  approval, missing/failing evidence, or "ready to advance" — read
   *  straight off the same gates advancePhase() itself checks, never a
   *  separately-maintained guess. */
  nextAction: string;
}

/** One project's full lifecycle picture: phase, who is responsible for it
 *  right now, its open/blocked tasks, and any approval it is waiting on. */
export function projectLifecycleSummary(db: Db, projectId: string): ProjectLifecycleSummary {
  const state = getOrCreateLifecycleState(db, projectId);
  const tasks = db.lifecycleTasks.byProjectId(projectId).filter((t) => t.status !== 'done');
  const approvals = db.lifecycleApprovals.byProjectId(projectId).filter((a) => a.status === 'pending');

  const evidenceKind = PHASE_EXIT_EVIDENCE[state.currentPhase];
  const requiredEvidence = evidenceKind
    ? (() => {
        const rows = db.lifecycleEvidence.byProjectPhase(projectId, state.currentPhase);
        const latest = rows[0] ?? null;
        return { kind: evidenceKind, satisfied: latest?.ok === true, latestSummary: latest?.summary ?? null };
      })()
    : null;

  const blockingApproval = APPROVAL_GATED_PHASES.has(state.currentPhase)
    ? approvals.find((a) => a.phase === state.currentPhase)
    : undefined;

  let nextAction: string;
  if (isLastPhase(state.currentPhase)) {
    nextAction = `Project is at the final phase (${state.currentPhase}) — no further advance possible.`;
  } else if (requiredEvidence && !requiredEvidence.satisfied) {
    nextAction = `Waiting on passing '${requiredEvidence.kind}' evidence before this phase can advance.`;
  } else if (blockingApproval) {
    nextAction = `Waiting on approval: "${blockingApproval.title}".`;
  } else {
    nextAction = `Ready to advance to the next phase.`;
  }

  return {
    projectId,
    currentPhase: state.currentPhase,
    responsibleAgentId: PHASE_RESPONSIBLE_AGENT[state.currentPhase],
    openTasks: tasks,
    pendingApprovals: approvals,
    updatedAt: state.updatedAt,
    requiredEvidence,
    nextAction,
  };
}
