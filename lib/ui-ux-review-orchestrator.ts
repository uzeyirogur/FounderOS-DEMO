import { collectSourceFiles } from '@/lib/security-review';
import { scanJsxAccessibility, type A11yFinding } from '@/lib/ui-ux-review';

export type UiUxReport = {
  projectDir: string;
  findings: A11yFinding[];
  ok: boolean;
  generatedAt: string;
};

/**
 * Real static accessibility review against a real directory. Reuses
 * collectSourceFiles() from lib/security-review.ts (same skip list:
 * node_modules/.git/.next/dist/build/coverage) so this doesn't
 * re-implement the filesystem walk.
 */
export function runUiUxReview(projectDir: string): UiUxReport {
  const files = collectSourceFiles(projectDir).filter((f) => f.path.endsWith('.tsx'));
  const findings = scanJsxAccessibility(files);
  return { projectDir, findings, ok: findings.length === 0, generatedAt: new Date().toISOString() };
}
