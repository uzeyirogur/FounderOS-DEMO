import { describe, it, expect, vi } from 'vitest';
import { dispatchClaudeCode, allowedToolsForPermission } from '@/lib/claude-code-dispatch';

/**
 * dispatchClaudeCode(execFn, { projectDir, prompt, permissionLevel }) —
 * a pure wrapper around a real `claude -p` invocation (execFn injected so
 * this is testable without actually shelling out). Permission level comes
 * straight from the Project Registry's own ProjectPermissionLevelSchema
 * (read_only, auto_safe_write, full_with_approval) — this module does not
 * invent a parallel permission concept. No permission level EVER allows
 * push, force-push, or merge — those stay under the operator's explicit
 * approval per the Approval Policy, independent of permissionLevel.
 */
describe('allowedToolsForPermission', () => {
  it('read_only projects get read-only tools, no Edit/Write/Bash', () => {
    const tools = allowedToolsForPermission('read_only');
    expect(tools).toContain('Read');
    expect(tools).not.toContain('Write');
    expect(tools).not.toContain('Edit');
    expect(tools.some((t) => t.startsWith('Bash'))).toBe(false);
  });

  it('auto_safe_write allows local edits and safe bash, never push/merge', () => {
    const tools = allowedToolsForPermission('auto_safe_write');
    expect(tools).toContain('Read');
    expect(tools).toContain('Edit');
    expect(tools).toContain('Write');
    expect(tools.some((t) => t.includes('git push'))).toBe(false);
    expect(tools.some((t) => t.includes('git merge'))).toBe(false);
  });

  it('full_with_approval still never allows push/merge — that gate is not permissionLevel-controlled', () => {
    const tools = allowedToolsForPermission('full_with_approval');
    expect(tools.some((t) => t.includes('git push'))).toBe(false);
    expect(tools.some((t) => t.includes('git merge'))).toBe(false);
    expect(tools.some((t) => t.includes('--force'))).toBe(false);
  });
});

describe('dispatchClaudeCode', () => {
  it('runs the real exec function with the right flags and parses success', async () => {
    const execFn = vi.fn().mockResolvedValue({
      stdout: JSON.stringify({ type: 'result', subtype: 'success', result: 'Fixed the bug.', session_id: 's1', num_turns: 3, total_cost_usd: 0.05 }),
      stderr: '',
    });
    const result = await dispatchClaudeCode(execFn, { projectDir: '/tmp/proj', prompt: 'fix the bug', permissionLevel: 'auto_safe_write' });
    expect(execFn).toHaveBeenCalledWith(
      'claude',
      expect.arrayContaining(['-p', 'fix the bug', '--output-format', 'json']),
      expect.objectContaining({ cwd: '/tmp/proj' }),
    );
    if (!result.ok) throw new Error('expected dispatchClaudeCode to succeed');
    if (result.dryRun) throw new Error('expected a real result, not a dry run');
    expect(result.result).toBe('Fixed the bug.');
    expect(result.sessionId).toBe('s1');
  });

  it('reports an honest failure when claude itself errors, never fabricates success', async () => {
    const execFn = vi.fn().mockRejectedValue(new Error('claude: command not found'));
    const result = await dispatchClaudeCode(execFn, { projectDir: '/tmp/proj', prompt: 'x', permissionLevel: 'read_only' });
    if (result.ok) throw new Error('expected dispatchClaudeCode to fail');
    expect(result.reason).toMatch(/command not found/);
  });

  it('reports an honest failure when claude returns a non-success subtype', async () => {
    const execFn = vi.fn().mockResolvedValue({
      stdout: JSON.stringify({ type: 'result', subtype: 'error_max_turns', result: '', session_id: 's2', num_turns: 10, total_cost_usd: 0.2 }),
      stderr: '',
    });
    const result = await dispatchClaudeCode(execFn, { projectDir: '/tmp/proj', prompt: 'x', permissionLevel: 'auto_safe_write' });
    if (result.ok) throw new Error('expected dispatchClaudeCode to fail');
    expect(result.reason).toMatch(/error_max_turns/);
  });
});
