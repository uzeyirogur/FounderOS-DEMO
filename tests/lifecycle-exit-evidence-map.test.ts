import { describe, it, expect } from 'vitest';
import { PHASE_EXIT_EVIDENCE, PROJECT_LIFECYCLE_PHASES } from '@/lib/project-lifecycle';

describe('PHASE_EXIT_EVIDENCE', () => {
  it('covers every phase with either a required evidence kind or null (no requirement)', () => {
    for (const phase of PROJECT_LIFECYCLE_PHASES) {
      expect(PHASE_EXIT_EVIDENCE).toHaveProperty(phase);
    }
  });

  it('implementation requires build_test evidence — a phase is not "done" because an agent said so', () => {
    expect(PHASE_EXIT_EVIDENCE.implementation).toBe('build_test');
  });

  it('qa requires qa_report evidence', () => {
    expect(PHASE_EXIT_EVIDENCE.qa).toBe('qa_report');
  });

  it('security requires security_report evidence', () => {
    expect(PHASE_EXIT_EVIDENCE.security).toBe('security_report');
  });

  it('ui_ux requires ui_ux_report evidence', () => {
    expect(PHASE_EXIT_EVIDENCE.ui_ux).toBe('ui_ux_report');
  });

  it('launch_readiness requires a checklist', () => {
    expect(PHASE_EXIT_EVIDENCE.launch_readiness).toBe('launch_checklist');
  });

  it('idea and research have no evidence requirement (nothing objective to check yet)', () => {
    expect(PHASE_EXIT_EVIDENCE.idea).toBeNull();
    expect(PHASE_EXIT_EVIDENCE.research).toBeNull();
  });
});
