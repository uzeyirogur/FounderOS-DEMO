/**
 * Security Reviewer's real, no-paid-tool checks. Parses actual tool
 * output — this repo's own `npm audit --json` — never re-implements
 * vulnerability detection. Secret scanning is regex-based and ONLY ever
 * reports file+line+pattern name, never the matched value: a security
 * report must never itself become a leak.
 */

export type NpmAuditSummary = {
  total: number;
  info: number;
  low: number;
  moderate: number;
  high: number;
  critical: number;
  ok: boolean;
};

export function parseNpmAuditJson(raw: string): NpmAuditSummary | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const body = parsed as { metadata?: { vulnerabilities?: Record<string, unknown> } };
  const v = body.metadata?.vulnerabilities;
  if (!v || typeof v !== 'object') return null;
  const info = typeof v.info === 'number' ? v.info : 0;
  const low = typeof v.low === 'number' ? v.low : 0;
  const moderate = typeof v.moderate === 'number' ? v.moderate : 0;
  const high = typeof v.high === 'number' ? v.high : 0;
  const critical = typeof v.critical === 'number' ? v.critical : 0;
  const total = typeof v.total === 'number' ? v.total : info + low + moderate + high + critical;
  return { total, info, low, moderate, high, critical, ok: high === 0 && critical === 0 };
}

export type SecretFinding = { path: string; line: number; pattern: string };

interface SecretPattern {
  name: string;
  regex: RegExp;
}

// Patterns are deliberately narrow (real-shaped secrets), not "any long
// hex string", to keep false positives low enough that a report is worth
// reading. process.env.X references are exactly what should NOT match —
// that is the safe, correct way to hold a credential in this codebase.
const SECRET_PATTERNS: SecretPattern[] = [
  { name: 'aws-access-key', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'private-key-block', regex: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  {
    name: 'generic-secret-assignment',
    // const/let apiKey = "sk-..." style literal assignment — not process.env.X
    regex: /\b(api[_-]?key|secret|token|password)\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/i,
  },
];

export interface SourceFile {
  path: string;
  content: string;
}

export function scanForSecrets(files: SourceFile[]): SecretFinding[] {
  const findings: SecretFinding[] = [];
  for (const file of files) {
    const lines = file.content.split('\n');
    lines.forEach((lineText, idx) => {
      if (/process\.env\./.test(lineText)) return; // the correct pattern — never flag it
      for (const p of SECRET_PATTERNS) {
        if (p.regex.test(lineText)) {
          findings.push({ path: file.path, line: idx + 1, pattern: p.name });
          break; // one finding per line is enough for a readable report
        }
      }
    });
  }
  return findings;
}

// ── Real filesystem + npm audit wiring ───────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage']);
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.env', '.yml', '.yaml']);
const MAX_FILES = 2000; // guard against scanning something enormous by mistake

/**
 * Walks a REAL directory on disk and returns SourceFile[] ready for
 * scanForSecrets — skips node_modules/.git/.next/dist/build/coverage so a
 * scan stays fast and never flags vendored or generated code as if it
 * were ours.
 */
export function collectSourceFiles(rootDir: string): SourceFile[] {
  const files: SourceFile[] = [];

  function walk(dir: string) {
    if (files.length >= MAX_FILES) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // unreadable dir — skip, do not crash the whole scan
    }
    for (const entry of entries) {
      if (files.length >= MAX_FILES) return;
      if (entry.name.startsWith('.') && entry.name !== '.env') {
        if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) continue; // skip hidden dirs like .vscode
        if (entry.isFile() && entry.name !== '.env' && entry.name !== '.env.local') continue;
      }
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (!SOURCE_EXTENSIONS.has(ext) && !entry.name.startsWith('.env')) continue;
        try {
          const content = fs.readFileSync(full, 'utf-8');
          files.push({ path: full, content });
        } catch {
          // binary or unreadable — skip rather than crash
        }
      }
    }
  }

  walk(rootDir);
  return files;
}

import { execFile } from 'node:child_process';

/**
 * Runs the real `npm audit --json` in a project directory and parses its
 * real output — no re-implementation of vulnerability detection. Honest
 * failure (null) when npm itself is missing or the directory has no
 * package.json, rather than fabricating a clean report.
 */
export function runNpmAuditLive(cwd: string): Promise<NpmAuditSummary | null> {
  return new Promise((resolve) => {
    execFile('npm', ['audit', '--json'], { cwd, timeout: 60_000, maxBuffer: 10 * 1024 * 1024 }, (_err, stdout) => {
      // npm audit exits non-zero when vulnerabilities are found — that is
      // expected and NOT a real error; parse stdout regardless of exit code.
      resolve(stdout ? parseNpmAuditJson(stdout) : null);
    });
  });
}
