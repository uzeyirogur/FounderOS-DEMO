import { describe, it, expect } from 'vitest';
import {
  PROJECT_LIFECYCLE_PHASES,
  PHASE_RESPONSIBLE_AGENT,
  nextPhase,
  previousPhase,
  isLastPhase,
  isFirstPhase,
  phaseIndex,
} from '@/lib/project-lifecycle';

/**
 * The standard, project-agnostic lifecycle every Project Registry entry
 * moves through. Nothing here names a specific project — it is pure phase
 * order + a default "who is normally responsible" map that any project can
 * use or override per-task.
 */
describe('PROJECT_LIFECYCLE_PHASES', () => {
  it('is the 16-phase standard lifecycle in order', () => {
    expect(PROJECT_LIFECYCLE_PHASES).toEqual([
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
    ]);
  });

  it('every phase has a default responsible agent id', () => {
    for (const phase of PROJECT_LIFECYCLE_PHASES) {
      expect(PHASE_RESPONSIBLE_AGENT[phase]).toBeTruthy();
    }
  });
});

describe('phaseIndex / nextPhase / previousPhase', () => {
  it('phaseIndex finds the 0-based position of a phase', () => {
    expect(phaseIndex('idea')).toBe(0);
    expect(phaseIndex('reporting')).toBe(15);
  });

  it('nextPhase advances one step, null past the last phase', () => {
    expect(nextPhase('idea')).toBe('research');
    expect(nextPhase('reporting')).toBeNull();
  });

  it('previousPhase steps back one, null before the first phase', () => {
    expect(previousPhase('research')).toBe('idea');
    expect(previousPhase('idea')).toBeNull();
  });

  it('isFirstPhase / isLastPhase identify the boundaries', () => {
    expect(isFirstPhase('idea')).toBe(true);
    expect(isFirstPhase('research')).toBe(false);
    expect(isLastPhase('reporting')).toBe(true);
    expect(isLastPhase('iteration')).toBe(false);
  });
});
