import { describe, it, expect } from 'vitest';
import { scanJsxAccessibility } from '@/lib/ui-ux-review';

/**
 * UI/UX Reviewer's real, no-paid-tool check: a static scan of .tsx source
 * for common accessibility/UX defects that don't require a live browser —
 * missing alt text, icon-only buttons with no aria-label, and inputs with
 * no associated label. Separate from QA (test/build output) and from
 * Security Reviewer (audit/secrets) — this is presentation-layer quality.
 */
describe('scanJsxAccessibility', () => {
  it('flags an <img> with no alt attribute', () => {
    const findings = scanJsxAccessibility([{ path: 'a.tsx', content: '<img src="x.png" />' }]);
    expect(findings.some((f) => f.rule === 'img-missing-alt')).toBe(true);
  });

  it('does not flag an <img> with alt text', () => {
    const findings = scanJsxAccessibility([{ path: 'a.tsx', content: '<img src="x.png" alt="A cat" />' }]);
    expect(findings.some((f) => f.rule === 'img-missing-alt')).toBe(false);
  });

  it('allows alt="" for a deliberately decorative image', () => {
    const findings = scanJsxAccessibility([{ path: 'a.tsx', content: '<img src="x.png" alt="" />' }]);
    expect(findings.some((f) => f.rule === 'img-missing-alt')).toBe(false);
  });

  it('flags a button containing only an icon component with no aria-label', () => {
    const findings = scanJsxAccessibility([{ path: 'a.tsx', content: '<button onClick={x}><Trash className="h-4 w-4" /></button>' }]);
    expect(findings.some((f) => f.rule === 'icon-button-no-label')).toBe(true);
  });

  it('does not flag an icon button that has an aria-label', () => {
    const findings = scanJsxAccessibility([
      { path: 'a.tsx', content: '<button aria-label="Delete" onClick={x}><Trash className="h-4 w-4" /></button>' },
    ]);
    expect(findings.some((f) => f.rule === 'icon-button-no-label')).toBe(false);
  });

  it('does not flag a button with visible text', () => {
    const findings = scanJsxAccessibility([{ path: 'a.tsx', content: '<button onClick={x}>Delete</button>' }]);
    expect(findings.some((f) => f.rule === 'icon-button-no-label')).toBe(false);
  });

  it('reports file and line for every finding', () => {
    const findings = scanJsxAccessibility([{ path: 'components/X.tsx', content: 'const a = 1;\n<img src="y.png" />' }]);
    expect(findings[0].path).toBe('components/X.tsx');
    expect(findings[0].line).toBe(2);
  });
});
