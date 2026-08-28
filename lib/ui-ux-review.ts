/**
 * UI/UX Reviewer's real, no-paid-tool check: a static regex/line scan of
 * .tsx source for common accessibility defects that don't need a live
 * browser. Deliberately narrow (real-shaped mistakes, not "any JSX"), to
 * keep the report worth reading. Reuses lib/security-review.ts's
 * collectSourceFiles() pattern for the filesystem walk.
 */

export type A11yFinding = { path: string; line: number; rule: string };

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

export function scanJsxAccessibility(files: SourceFile[]): A11yFinding[] {
  const findings: A11yFinding[] = [];

  for (const file of files) {
    // img-missing-alt: scan tag-by-tag (a single <img> can span within one
    // line in this codebase's formatting), report the line it starts on.
    let imgMatch: RegExpExecArray | null;
    IMG_TAG.lastIndex = 0;
    while ((imgMatch = IMG_TAG.exec(file.content)) !== null) {
      if (!HAS_ALT.test(imgMatch[0])) {
        const line = file.content.slice(0, imgMatch.index).split('\n').length;
        findings.push({ path: file.path, line, rule: 'img-missing-alt' });
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
        const line = file.content.slice(0, btnMatch.index).split('\n').length;
        findings.push({ path: file.path, line, rule: 'icon-button-no-label' });
      }
    }
  }

  return findings;
}
