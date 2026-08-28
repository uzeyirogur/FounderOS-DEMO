import { describe, it, expect } from 'vitest';
import { parseNpmAuditJson, scanForSecrets } from '@/lib/security-review';

/**
 * Security Reviewer's two real, no-paid-tool checks:
 *  1. parseNpmAuditJson — parses `npm audit --json` output (never
 *     re-implements audit logic, just reads real npm's verdict).
 *  2. scanForSecrets — regex-based scan for committed credentials. Only
 *     ever reports file+line+pattern name — NEVER the matched value, so a
 *     real secret is never echoed back into a report.
 */
describe('parseNpmAuditJson', () => {
  it('summarizes severity counts from a real npm audit --json shape', () => {
    const raw = JSON.stringify({
      vulnerabilities: {
        foo: { severity: 'high', name: 'foo' },
        bar: { severity: 'critical', name: 'bar' },
        baz: { severity: 'low', name: 'baz' },
      },
      metadata: { vulnerabilities: { info: 0, low: 1, moderate: 0, high: 1, critical: 1, total: 3 } },
    });
    const summary = parseNpmAuditJson(raw);
    expect(summary).not.toBeNull();
    expect(summary!.total).toBe(3);
    expect(summary!.critical).toBe(1);
    expect(summary!.high).toBe(1);
    expect(summary!.ok).toBe(false);
  });

  it('is ok when there are zero vulnerabilities', () => {
    const raw = JSON.stringify({ vulnerabilities: {}, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } } });
    const summary = parseNpmAuditJson(raw);
    expect(summary!.ok).toBe(true);
  });

  it('returns null on unparseable output rather than guessing', () => {
    expect(parseNpmAuditJson('not json at all')).toBeNull();
    expect(parseNpmAuditJson('{}')).toBeNull();
  });
});

describe('scanForSecrets', () => {
  it('flags an AWS-style access key without ever including the matched value', () => {
    const findings = scanForSecrets([{ path: 'lib/x.ts', content: 'const key = "AKIAABCDEFGHIJKLMNOP";' }]);
    expect(findings).toHaveLength(1);
    expect(findings[0].pattern).toBe('aws-access-key');
    expect(findings[0].path).toBe('lib/x.ts');
    expect(findings[0].line).toBe(1);
    expect(JSON.stringify(findings)).not.toContain('AKIAABCDEFGHIJKLMNOP');
  });

  it('flags a hardcoded generic API key assignment', () => {
    const findings = scanForSecrets([{ path: 'lib/y.ts', content: 'const apiKey = "sk-abcdef1234567890abcdef1234567890";' }]);
    expect(findings.some((f) => f.pattern === 'generic-secret-assignment')).toBe(true);
  });

  it('flags a PEM private key block', () => {
    const findings = scanForSecrets([{ path: 'lib/z.ts', content: '-----BEGIN RSA PRIVATE KEY-----\nMIIBogI...' }]);
    expect(findings.some((f) => f.pattern === 'private-key-block')).toBe(true);
  });

  it('does not flag a reference to an env var — that is the correct pattern', () => {
    const findings = scanForSecrets([{ path: 'lib/ok.ts', content: 'const key = process.env.STRIPE_SECRET_KEY;' }]);
    expect(findings).toHaveLength(0);
  });

  it('does not flag ordinary code', () => {
    const findings = scanForSecrets([{ path: 'lib/ok2.ts', content: 'export function add(a: number, b: number) { return a + b; }' }]);
    expect(findings).toHaveLength(0);
  });
});
