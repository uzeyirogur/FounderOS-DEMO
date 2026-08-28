import { collectSourceFiles, runNpmAuditLive, scanForSecrets, scanForCodePatterns, type NpmAuditSummary, type SecretFinding, type CodeFinding } from '@/lib/security-review';

export type SecurityReport = {
  projectDir: string;
  audit: NpmAuditSummary | null;
  secrets: SecretFinding[];
  codeFindings: CodeFinding[];
  ok: boolean;
  generatedAt: string;
};

/**
 * The real, combined security check against a real directory: `npm
 * audit --json` (dependency vulnerabilities) + a regex secret scan
 * (never re-reports the matched value) + code pattern checks (CORS,
 * injection-shaped strings, eval, unguarded mutating routes, hardcoded
 * env fallbacks). ok is false whenever anything is found, AND whenever
 * the audit itself could not be read — an unknown state is never
 * reported as "clean".
 */
export async function runSecurityReview(projectDir: string): Promise<SecurityReport> {
  const [audit, files] = await Promise.all([
    runNpmAuditLive(projectDir),
    Promise.resolve(collectSourceFiles(projectDir)),
  ]);
  const secrets = scanForSecrets(files);
  const codeFindings = scanForCodePatterns(files);
  const auditOk = audit !== null && audit.ok;
  const ok = auditOk && secrets.length === 0 && codeFindings.length === 0;
  return { projectDir, audit, secrets, codeFindings, ok, generatedAt: new Date().toISOString() };
}
