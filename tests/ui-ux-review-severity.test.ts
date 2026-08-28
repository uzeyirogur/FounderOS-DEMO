import { describe, it, expect } from 'vitest';
import { scanJsxAccessibility, type SourceFile } from '@/lib/ui-ux-review';

/**
 * The overnight plan asks UI/UX Reviewer to never just say "good/bad" —
 * every finding needs severity + evidence + a concrete suggestion. This
 * extends the existing real static scan (never a live browser claim) with
 * that shape, plus two new real checks: a form input with no associated
 * label, and an empty (whitespace-only) heading.
 */
describe('scanJsxAccessibility — severity + evidence + suggestion', () => {
  it('every finding carries severity, the real matched line as evidence, and a concrete suggestion', () => {
    const files: SourceFile[] = [{ path: 'app/x.tsx', content: `<img src="/a.png" />` }];
    const findings = scanJsxAccessibility(files);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('high');
    expect(findings[0].evidence).toContain('<img');
    expect(findings[0].suggestion.length).toBeGreaterThan(0);
  });

  it('flags an <input> with no associated <label>, id/htmlFor, or aria-label', () => {
    const files: SourceFile[] = [{ path: 'app/x.tsx', content: `<input type="text" value={name} onChange={set} />` }];
    const findings = scanJsxAccessibility(files);
    expect(findings.some((f) => f.rule === 'input-missing-label')).toBe(true);
  });

  it('does not flag an <input> with aria-label', () => {
    const files: SourceFile[] = [{ path: 'app/x.tsx', content: `<input aria-label="Name" type="text" />` }];
    const findings = scanJsxAccessibility(files);
    expect(findings.some((f) => f.rule === 'input-missing-label')).toBe(false);
  });

  it('does not flag an <input> with a matching htmlFor/id pair on the same file', () => {
    const files: SourceFile[] = [
      { path: 'app/x.tsx', content: `<label htmlFor="name">Name</label>\n<input id="name" type="text" />` },
    ];
    const findings = scanJsxAccessibility(files);
    expect(findings.some((f) => f.rule === 'input-missing-label')).toBe(false);
  });

  it('flags an empty (whitespace-only) heading', () => {
    const files: SourceFile[] = [{ path: 'app/x.tsx', content: `<h2>   </h2>` }];
    const findings = scanJsxAccessibility(files);
    expect(findings.some((f) => f.rule === 'empty-heading')).toBe(true);
  });

  it('does not flag a heading with real text or a JSX expression child', () => {
    const files: SourceFile[] = [{ path: 'app/x.tsx', content: `<h2>{title}</h2>` }];
    const findings = scanJsxAccessibility(files);
    expect(findings.some((f) => f.rule === 'empty-heading')).toBe(false);
  });
});
