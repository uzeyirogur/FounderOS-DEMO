import type { ProjectPermissionLevel } from '@/lib/schemas';

export type ExecFn = (
  cmd: string,
  args: string[],
  opts: { cwd: string },
) => Promise<{ stdout: string; stderr: string }>;

export interface DispatchClaudeCodeInput {
  projectDir: string;
  prompt: string;
  permissionLevel: ProjectPermissionLevel;
  /** When true, never calls execFn — returns the exact command that WOULD
   *  run (prompt + allowed tools) so a plan can be reviewed with zero cost
   *  before a real, paid `claude -p` call is authorized. */
  dryRun?: boolean;
}

export type DispatchResult =
  | { ok: true; result: string; sessionId: string; numTurns: number; totalCostUsd: number; dryRun?: false }
  | { ok: true; dryRun: true; result: string; allowedTools: string[] }
  | { ok: false; reason: string };

/**
 * Wraps a raw goal with real project context — stack detection and current
 * lifecycle phase, when known — so a dispatched Claude Code run isn't
 * flying blind. Every context line is real data passed in by the caller;
 * this never invents a stack, phase, or placeholder value. Missing context
 * is simply omitted, not filled with "unknown"/"n/a".
 */
export function buildDispatchPrompt(input: { goal: string; stackNote?: string; lifecyclePhase?: string }): string {
  const lines = [input.goal];
  if (input.stackNote) lines.push(`Project stack: ${input.stackNote}`);
  if (input.lifecyclePhase) lines.push(`Current lifecycle phase: ${input.lifecyclePhase}`);
  lines.push('Never run git push, git merge, or any command that publishes/deploys — that always needs a separate human approval.');
  return lines.join('\n\n');
}

/**
 * Maps a Project Registry permission level to a real Claude Code
 * --allowedTools whitelist. read_only never gets write/bash tools at all.
 * auto_safe_write and full_with_approval both get local file edits and a
 * SAFE bash subset — but NO level ever includes `git push`, `git merge`,
 * or `--force` in any form: that gate is enforced here, independent of
 * what the Project Registry's permissionLevel says, per the Approval
 * Policy (push/merge/deploy always need the operator's explicit yes).
 */
export function allowedToolsForPermission(level: ProjectPermissionLevel): string[] {
  if (level === 'read_only') {
    return ['Read', 'Grep', 'Glob'];
  }
  // auto_safe_write and full_with_approval: same tool surface. The
  // difference between them is a product decision (whether Claude may
  // commit locally without asking) that lives in the prompt/workflow,
  // not in which tools it can touch — but push/merge are excluded from
  // BOTH, unconditionally.
  return [
    'Read',
    'Grep',
    'Glob',
    'Edit',
    'Write',
    'Bash(npm test*)',
    'Bash(npm run typecheck*)',
    'Bash(npm run build*)',
    'Bash(git status*)',
    'Bash(git diff*)',
    'Bash(git add*)',
    'Bash(git commit*)',
  ];
}

/**
 * Real dispatch to `claude -p` for a Project Registry-authorized
 * directory. execFn is injected (never a hardcoded child_process call in
 * this module) so the wiring is unit-testable; the live wrapper
 * (dispatchClaudeCodeLive) is what actually shells out. Honest failure on
 * any exec error or non-success subtype — never fabricates a completed
 * task.
 */
export async function dispatchClaudeCode(execFn: ExecFn, input: DispatchClaudeCodeInput): Promise<DispatchResult> {
  const allowedTools = allowedToolsForPermission(input.permissionLevel);

  if (input.dryRun) {
    return {
      ok: true,
      dryRun: true,
      result: `[DRY RUN — no real dispatch made] claude -p "${input.prompt}" --allowedTools ${allowedTools.join(',')} (cwd: ${input.projectDir})`,
      allowedTools,
    };
  }

  try {
    const { stdout } = await execFn(
      'claude',
      ['-p', input.prompt, '--output-format', 'json', '--max-turns', '10', '--allowedTools', allowedTools.join(',')],
      { cwd: input.projectDir },
    );
    const parsed = JSON.parse(stdout) as {
      type: string;
      subtype: string;
      result: string;
      session_id: string;
      num_turns: number;
      total_cost_usd: number;
    };
    if (parsed.subtype !== 'success') {
      return { ok: false, reason: `claude returned subtype "${parsed.subtype}" — not a completed success` };
    }
    return {
      ok: true,
      result: parsed.result,
      sessionId: parsed.session_id,
      numTurns: parsed.num_turns,
      totalCostUsd: parsed.total_cost_usd,
    };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * dispatchClaudeCode wired to a real child_process invocation of the
 * `claude` CLI. Honest not_configured when the binary is missing.
 */
export async function dispatchClaudeCodeLive(input: DispatchClaudeCodeInput): Promise<DispatchResult> {
  const { execFile } = await import('node:child_process');
  const execFn: ExecFn = (cmd, args, opts) =>
    new Promise((resolve, reject) => {
      execFile(cmd, args, { cwd: opts.cwd, maxBuffer: 1024 * 1024 * 20 }, (error, stdout, stderr) => {
        if (error) {
          reject(
            error.message.includes('ENOENT')
              ? new Error("claude CLI not found on PATH — install with 'npm install -g @anthropic-ai/claude-code' and run 'claude' once to authenticate")
              : error,
          );
          return;
        }
        resolve({ stdout, stderr });
      });
    });
  return dispatchClaudeCode(execFn, input);
}
