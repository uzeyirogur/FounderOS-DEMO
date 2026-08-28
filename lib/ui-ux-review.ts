/**
 * UI/UX Reviewer's real, no-paid-tool check: a static regex/line scan of
 * .tsx source for common accessibility defects that don't need a live
 * browser. Deliberately narrow (real-shaped mistakes, not "any JSX"), to
 * keep the report worth reading. Reuses lib/security-review.ts's
 * collectSourceFiles() pattern for the filesystem walk.
 *
 * Every finding carries severity + evidence (the real matched source
 * text) + a concrete suggestion — never just "good/bad" with no way to
 * act on it, per the overnight plan's requirement.
 */

export type A11ySeverity = 'high' | 'medium' | 'low';

export type A11yFinding = {
  path: string;
  line: number;
  rule: string;
  severity: A11ySeverity;
  /** The real matched source snippet — never a description of what MIGHT
   *  be there, always what actually IS there. */
  evidence: string;
  suggestion: string;
};

export interface SourceFile {
  path: string;
  content: string;
}

const IMG_TAG = /<img\b[^>]*>/gi;
const HAS_ALT = /\balt\s*=/i;

const BUTTON_TAG = /<button\b[^>]*>([\s\S]*?)<\/button>/gi;
const HAS_ARIA_LABEL = /\baria-label\s*=/i;
// A JSX component reference inside the button body, e.g. <Trash ... /> —
// icon components are PascalCase and self-closing.
const ICON_ONLY_CHILD = /^<[A-Z][A-Za-z0-9]*\b[^>]*\/>$/;

const INPUT_TAG = /<input\b[^>]*>/gi;
const HAS_ARIA_LABELLEDBY = /\baria-labelledby\s*=/i;
const INPUT_ID = /\bid\s*=\s*["'{]([^"'}]+)["'}]/;
const LABEL_FOR = /\bhtmlFor\s*=\s*["'{]([^"'}]+)["'}]/g;

const HEADING_TAG = /<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi;

function lineOf(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

export function scanJsxAccessibility(files: SourceFile[]): A11yFinding[] {
  const findings: A11yFinding[] = [];

  for (const file of files) {
    // img-missing-alt: scan tag-by-tag (a single <img> can span within one
    // line in this codebase's formatting), report the line it starts on.
    let imgMatch: RegExpExecArray | null;
    IMG_TAG.lastIndex = 0;
    while ((imgMatch = IMG_TAG.exec(file.content)) !== null) {
      if (!HAS_ALT.test(imgMatch[0])) {
        findings.push({
          path: file.path,
          line: lineOf(file.content, imgMatch.index),
          rule: 'img-missing-alt',
          severity: 'high',
          evidence: imgMatch[0].slice(0, 200),
          suggestion: "Add an alt attribute describing the image's content, or alt=\"\" if it is purely decorative.",
        });
      }
    }

    // icon-button-no-label: a <button> whose only child is a single
    // self-closing PascalCase component (an icon) and no aria-label / no
    // visible text content.
    let btnMatch: RegExpExecArray | null;
    BUTTON_TAG.lastIndex = 0;
    while ((btnMatch = BUTTON_TAG.exec(file.content)) !== null) {
      const openTag = btnMatch[0].slice(0, btnMatch[0].indexOf('>') + 1);
      const body = btnMatch[1].trim();
      if (HAS_ARIA_LABEL.test(openTag)) continue;
      if (ICON_ONLY_CHILD.test(body)) {
        findings.push({
          path: file.path,
          line: lineOf(file.content, btnMatch.index),
          rule: 'icon-button-no-label',
          severity: 'high',
          evidence: openTag.slice(0, 200),
          suggestion: `Add aria-label="..." describing the action this button performs.`,
        });
      }
    }

    // input-missing-label: an <input> with no aria-label, aria-labelledby,
    // or a matching <label htmlFor="X"> for its id anywhere in the file.
    const labelTargets = new Set<string>();
    let labelMatch: RegExpExecArray | null;
    LABEL_FOR.lastIndex = 0;
    while ((labelMatch = LABEL_FOR.exec(file.content)) !== null) labelTargets.add(labelMatch[1]);

    let inputMatch: RegExpExecArray | null;
    INPUT_TAG.lastIndex = 0;
    while ((inputMatch = INPUT_TAG.exec(file.content)) !== null) {
      const tag = inputMatch[0];
      if (HAS_ARIA_LABEL.test(tag) || HAS_ARIA_LABELLEDBY.test(tag)) continue;
      const idMatch = tag.match(INPUT_ID);
      if (idMatch && labelTargets.has(idMatch[1])) continue;
      findings.push({
        path: file.path,
        line: lineOf(file.content, inputMatch.index),
        rule: 'input-missing-label',
        severity: 'high',
        evidence: tag.slice(0, 200),
        suggestion: 'Associate a <label htmlFor="..."> with a matching id, or add aria-label to this input.',
      });
    }

    // empty-heading: an h1-h6 whose text content is whitespace-only. A JSX
    // expression child ({title}) is real dynamic content, never flagged —
    // this only catches a literally empty/whitespace tag.
    let headingMatch: RegExpExecArray | null;
    HEADING_TAG.lastIndex = 0;
    while ((headingMatch = HEADING_TAG.exec(file.content)) !== null) {
      const body = headingMatch[2];
      if (body.trim().length === 0) {
        findings.push({
          path: file.path,
          line: lineOf(file.content, headingMatch.index),
          rule: 'empty-heading',
          severity: 'medium',
          evidence: headingMatch[0].slice(0, 200),
          suggestion: 'Give this heading real text, or remove it if unused — an empty heading confuses screen-reader navigation.',
        });
      }
    }
  }

  return findings;
}
