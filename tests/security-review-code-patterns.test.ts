import { describe, it, expect } from 'vitest';
import { scanForCodePatterns, type SourceFile } from '@/lib/security-review';

/**
 * Beyond npm audit + secret scanning: real pattern-based checks for the
 * things the overnight plan calls out — dangerous env exposure, unsafe
 * API routes, obvious injection patterns, permissive CORS. All
 * regex-based against real files, free/local, no paid SaaS.
 */
describe('scanForCodePatterns', () => {
  it('flags a wildcard CORS header', () => {
    const files: SourceFile[] = [
      { path: 'app/api/x/route.ts', content: `res.setHeader('Access-Control-Allow-Origin', '*');` },
    ];
    const findings = scanForCodePatterns(files);
    expect(findings.some((f) => f.pattern === 'wildcard-cors')).toBe(true);
  });

  it('does not flag a same-origin-safe CORS value', () => {
    const files: SourceFile[] = [
      { path: 'app/api/x/route.ts', content: `res.setHeader('Access-Control-Allow-Origin', 'https://example.com');` },
    ];
    const findings = scanForCodePatterns(files);
    expect(findings.some((f) => f.pattern === 'wildcard-cors')).toBe(false);
  });

  it('flags string-concatenated SQL as a possible injection pattern', () => {
    const files: SourceFile[] = [
      { path: 'lib/x.ts', content: `db.prepare("SELECT * FROM users WHERE id = " + userId).get();` },
    ];
    const findings = scanForCodePatterns(files);
    expect(findings.some((f) => f.pattern === 'sql-string-concat')).toBe(true);
  });

  it('does not flag a parameterized query', () => {
    const files: SourceFile[] = [
      { path: 'lib/x.ts', content: `db.prepare("SELECT * FROM users WHERE id = ?").get(userId);` },
    ];
    const findings = scanForCodePatterns(files);
    expect(findings.some((f) => f.pattern === 'sql-string-concat')).toBe(false);
  });

  it('flags a raw eval() call', () => {
    const files: SourceFile[] = [{ path: 'lib/x.ts', content: `const result = eval(userInput);` }];
    const findings = scanForCodePatterns(files);
    expect(findings.some((f) => f.pattern === 'eval-usage')).toBe(true);
  });

  it('flags dangerouslySetInnerHTML fed by something other than a literal', () => {
    const files: SourceFile[] = [{ path: 'app/x.tsx', content: `<div dangerouslySetInnerHTML={{ __html: userBio }} />` }];
    const findings = scanForCodePatterns(files);
    expect(findings.some((f) => f.pattern === 'dangerously-set-inner-html')).toBe(true);
  });

  it('flags a Next.js API route with a mutating handler and no visible auth/session check in the file', () => {
    const files: SourceFile[] = [
      {
        path: 'app/api/admin/delete-user/route.ts',
        content: `export async function POST(req: Request) {\n  const db = getDb();\n  db.users.delete(await req.json());\n  return Response.json({ ok: true });\n}`,
      },
    ];
    const findings = scanForCodePatterns(files);
    expect(findings.some((f) => f.pattern === 'unauthenticated-mutating-route')).toBe(true);
  });

  it('does not flag a mutating route that references a session/auth check', () => {
    const files: SourceFile[] = [
      {
        path: 'app/api/admin/delete-user/route.ts',
        content: `export async function POST(req: Request) {\n  const session = await getServerSession();\n  if (!session) return new Response('unauthorized', { status: 401 });\n  db.users.delete(await req.json());\n  return Response.json({ ok: true });\n}`,
      },
    ];
    const findings = scanForCodePatterns(files);
    expect(findings.some((f) => f.pattern === 'unauthenticated-mutating-route')).toBe(false);
  });

  it('does not flag a GET-only route (read-only) for missing auth', () => {
    const files: SourceFile[] = [
      { path: 'app/api/status/route.ts', content: `export async function GET() {\n  return Response.json({ ok: true });\n}` },
    ];
    const findings = scanForCodePatterns(files);
    expect(findings.some((f) => f.pattern === 'unauthenticated-mutating-route')).toBe(false);
  });

  it('flags a hardcoded env-looking value assigned as a fallback default (dangerous env exposure)', () => {
    const files: SourceFile[] = [
      { path: 'lib/x.ts', content: `const key = process.env.API_KEY || 'sk-live-abcdef1234567890';` },
    ];
    const findings = scanForCodePatterns(files);
    expect(findings.some((f) => f.pattern === 'hardcoded-env-fallback')).toBe(true);
  });

  it('never includes the actual matched snippet in a finding — path + line + pattern name only', () => {
    const files: SourceFile[] = [{ path: 'lib/x.ts', content: `const result = eval(userInput);` }];
    const findings = scanForCodePatterns(files);
    for (const f of findings) {
      expect(Object.keys(f).sort()).toEqual(['line', 'path', 'pattern']);
    }
  });
});
