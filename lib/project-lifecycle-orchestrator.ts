import { randomUUID } from 'node:crypto';
import type { openDb } from '@/lib/db';
import {
  PHASE_RESPONSIBLE_AGENT,
  nextPhase,
  isLastPhase,
  type ProjectLifecyclePhase,
} from '@/lib/project-lifecycle';
import type { LifecycleApproval, LifecycleTask, ProjectLifecycleState } from '@/lib/schemas';

type Db = ReturnType<typeof openDb>;

/** Phases a project may NOT leave without an approved LifecycleApproval row.
 *  Deliberately a short, explicit list rather than "any phase can gate" —
 *  today only the phase whose entire purpose is a go/no-go decision gates. */
const APPROVAL_GATED_PHASES = new Set<ProjectLifecyclePhase>(['deployment_approval']);

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
}

/** One project's full lifecycle picture: phase, who is responsible for it
 *  right now, its open/blocked tasks, and any approval it is waiting on. */
export function projectLifecycleSummary(db: Db, projectId: string): ProjectLifecycleSummary {
  const state = getOrCreateLifecycleState(db, projectId);
  const tasks = db.lifecycleTasks.byProjectId(projectId).filter((t) => t.status !== 'done');
  const approvals = db.lifecycleApprovals.byProjectId(projectId).filter((a) => a.status === 'pending');
  return {
    projectId,
    currentPhase: state.currentPhase,
    responsibleAgentId: PHASE_RESPONSIBLE_AGENT[state.currentPhase],
    openTasks: tasks,
    pendingApprovals: approvals,
    updatedAt: state.updatedAt,
  };
}
