import { randomUUID } from 'crypto';
import type { openDb } from '@/lib/db';
import type { DelegatedTask, DelegatedTaskPriority } from '@/lib/schemas';

type Db = ReturnType<typeof openDb>;

export interface ConductorStatus {
  pendingLifecycleApprovals: number;
  pendingPublishPlans: number;
  pendingOutboundMessages: number;
  candidateCapabilities: number;
  blockedContentPieces: number;
  totalBlockers: number;
}

/**
 * Chief of Staff v2's real cross-system status aggregation. Reads every
 * domain this build actually has — never hardcoded to a single project —
 * so "what is blocked / waiting on me" is always a live count, not a
 * guess. New domains added later should be added here too.
 */
export function aggregateStatus(db: Db): ConductorStatus {
  const pendingLifecycleApprovals = db.lifecycleApprovals.pending().length;
  const pendingPublishPlans = db.publishPlans.pending().length;
  const pendingOutboundMessages = db.outboundMessages.pending().length;
  const candidateCapabilities = db.capabilities.all().filter((c) => c.status === 'candidate').length;
  const blockedContentPieces = db.contentPieces.needsCapability().length;

  return {
    pendingLifecycleApprovals,
    pendingPublishPlans,
    pendingOutboundMessages,
    candidateCapabilities,
    blockedContentPieces,
    totalBlockers:
      pendingLifecycleApprovals + pendingPublishPlans + pendingOutboundMessages + candidateCapabilities + blockedContentPieces,
  };
}

// ── Intent classification ────────────────────────────────────────────────
// Deterministic keyword routing, not an LLM call — cheap, fast, testable,
// and good enough for "which department does this belong to". An agent id
// this build doesn't actually run is never returned; unmatched intent goes
// to the Conductor itself rather than guessing.
export const INTENT_RULES: Array<{ agentId: string; keywords: RegExp }> = [
  { agentId: 'qa-ui-review', keywords: /\b(test|typecheck|build|qa|bug|regression)\b/i },
  { agentId: 'security-reviewer', keywords: /\b(security|secret|vulnerab\w*|audit|exploit|injection|cors)\b/i },
  { agentId: 'ui-ux-reviewer', keywords: /\b(ui|ux|screen|accessib\w*|design|layout|responsive)\b/i },
  { agentId: 'social-content-studio', keywords: /\b(video|creative|carousel|ad creative|content piece|motion|mockup|landing page visual)\b/i },
  { agentId: 'ad-creative-research', keywords: /\b(ad trend|competitor messaging|creative research|hook)\b/i },
  { agentId: 'product-competitor-research', keywords: /\b(research|competitor landscape|market)\b/i },
  { agentId: 'growth-marketing', keywords: /\b(icp|positioning|funnel|seo|acquisition|pricing hypothesis)\b/i },
  { agentId: 'social-publishing', keywords: /\b(publish|schedule post|distribute)\b/i },
  { agentId: 'claude-code-orchestrator', keywords: /\b(implement|refactor|write code|fix the code|pull request)\b/i },
  { agentId: 'work-assistant', keywords: /\b(follow up|reminder|meeting prep|task list)\b/i },
  { agentId: 'personal-ops', keywords: /\b(personal|routine|appointment|checklist)\b/i },
];

export function classifyIntent(goal: string): string {
  for (const rule of INTENT_RULES) {
    if (rule.keywords.test(goal)) return rule.agentId;
  }
  return 'conductor';
}

// ── Delegation ────────────────────────────────────────────────────────────
const TERMINAL_STATUSES = new Set(['done', 'failed', 'cancelled']);

export interface DelegateTaskInput {
  source: string;
  projectId: string | null;
  goal: string;
  assignedAgentId?: string;
  priority?: DelegatedTaskPriority;
  dependencies?: string[];
}

/**
 * Classifies (or accepts an explicit) agent, creates a real DelegatedTask row,
 * and refuses to create a duplicate: if an open (non-terminal) task already
 * exists for the same project + agent + goal, that existing task is returned
 * instead of a new row. This is the "no duplicate work" requirement — it's
 * enforced structurally by a lookup, not by asking an LLM to remember.
 *
 * knownAgentIds (optional — the caller passes realAgents' ids; conductor.ts
 * itself never imports lib/agents/real.ts, which would be a circular import
 * since real.ts already imports aggregateStatus from this module) gates an
 * EXPLICIT assignedAgentId override against the actual runtime roster. A
 * classified (non-explicit) agent never needs this check — classifyIntent
 * only ever returns an INTENT_RULES agentId or 'conductor', and every
 * INTENT_RULES entry is proven real by the no-larp-routing test. When
 * knownAgentIds is omitted, no check runs — existing callers/tests that
 * don't care about this guard are unaffected.
 */
export function delegateTask(db: Db, input: DelegateTaskInput, knownAgentIds?: Set<string>): DelegatedTask {
  const assignedAgentId = input.assignedAgentId ?? classifyIntent(input.goal);
  if (input.assignedAgentId && knownAgentIds && !knownAgentIds.has(input.assignedAgentId)) {
    throw new Error(`delegateTask: "${input.assignedAgentId}" is not a real runtime agent — refusing to dispatch to an unknown agent id`);
  }
  const dependencies = input.dependencies ?? [];

  const scoped = input.projectId ? db.delegatedTasks.byProjectId(input.projectId) : db.delegatedTasks.all();
  const existing = scoped.find(
    (t) => t.assignedAgentId === assignedAgentId && t.goal === input.goal && !TERMINAL_STATUSES.has(t.status),
  );
  if (existing) return existing;

  const unmetDependency = dependencies.some((depId) => {
    const dep = db.delegatedTasks.byId(depId);
    return !dep || dep.status !== 'done';
  });

  const task: DelegatedTask = {
    id: randomUUID(),
    source: input.source,
    projectId: input.projectId,
    assignedAgentId,
    goal: input.goal,
    status: unmetDependency ? 'blocked' : 'pending',
    priority: input.priority ?? 'normal',
    dependencies,
    approvalRequirement: 'none',
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    resultSummary: null,
    failureReason: null,
    retryCount: 0,
  };
  db.delegatedTasks.insert(task);
  return task;
}

export function startTask(db: Db, id: string): void {
  db.delegatedTasks.updateStatus(id, { status: 'in_progress', startedAt: new Date().toISOString() });
}

/**
 * Marks a task done and unblocks any other pending/blocked task whose
 * dependency list is now fully satisfied — this is what lets the Conductor
 * chain multi-step work without a human re-triggering each step.
 */
export function completeTask(db: Db, id: string, resultSummary: string): void {
  db.delegatedTasks.updateStatus(id, { status: 'done', finishedAt: new Date().toISOString(), resultSummary });
  for (const t of db.delegatedTasks.all()) {
    if (t.status !== 'blocked' || t.dependencies.length === 0) continue;
    const allDone = t.dependencies.every((depId) => db.delegatedTasks.byId(depId)?.status === 'done');
    if (allDone) db.delegatedTasks.updateStatus(t.id, { status: 'pending' });
  }
}

export function failTask(db: Db, id: string, failureReason: string): void {
  db.delegatedTasks.updateStatus(id, { status: 'failed', finishedAt: new Date().toISOString(), failureReason });
}

/**
 * Creates a fresh pending task cloned from a failed/cancelled one — optionally
 * reassigned to a different agent. Refuses to retry a task that is still open
 * (pending/in_progress/blocked/awaiting_approval), since retrying live work
 * makes no sense and would itself create a duplicate.
 *
 * Hard-capped at MAX_RETRY_COUNT: retryCount is carried forward and
 * incremented on each retry, and once it would exceed the cap, retryTask
 * refuses instead of creating yet another attempt. A flaky task surfaces as
 * a real, visible failed/blocked task past the cap — never an invisible,
 * ever-repeating background loop.
 */
const MAX_RETRY_COUNT = 3;

export function retryTask(db: Db, id: string, opts?: { reassignTo?: string }): DelegatedTask {
  const original = db.delegatedTasks.byId(id);
  if (!original) throw new Error(`retryTask: no such task ${id}`);
  if (!TERMINAL_STATUSES.has(original.status)) {
    throw new Error(`retryTask: task ${id} is not terminal (status=${original.status})`);
  }
  if (original.retryCount >= MAX_RETRY_COUNT) {
    throw new Error(`retryTask: task ${id} has already been retried ${original.retryCount} time(s) — retry cap (${MAX_RETRY_COUNT}) reached, refusing another attempt`);
  }
  const retried: DelegatedTask = {
    ...original,
    id: randomUUID(),
    assignedAgentId: opts?.reassignTo ?? original.assignedAgentId,
    status: 'pending',
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    resultSummary: null,
    failureReason: null,
    retryCount: original.retryCount + 1,
  };
  db.delegatedTasks.insert(retried);
  return retried;
}
