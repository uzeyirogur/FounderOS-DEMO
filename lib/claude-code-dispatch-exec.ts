import type { ExecFn } from '@/lib/claude-code-dispatch';

/**
 * The real child_process ExecFn used by dispatchClaudeCodeLive, exported
 * separately so the run-queue execute route can pass it straight into
 * executeQueuedRun without going through dispatchClaudeCode a second time.
 */
export const dispatchClaudeCodeLiveExecFn: ExecFn = (cmd, args, opts) => {
  return new Promise((resolve, reject) => {
    import('node:child_process').then(({ execFile }) => {
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
  });
};
