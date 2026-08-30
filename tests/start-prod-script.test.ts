import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * scripts/start-prod.js — the cross-platform `npm start` wrapper Railway
 * (and any host that injects PORT at runtime) needs. `next start -p
 * ${PORT:-4100}` is bash-only syntax and breaks on Windows (npm shells out
 * via cmd.exe there), so this reads process.env.PORT in real Node.
 * Verified by inspection of the real script content (spawning a real
 * child `next start` against a production build is exercised at deploy
 * time, not in the unit suite, since it requires a real .next build).
 */
describe('scripts/start-prod.js', () => {
  const src = readFileSync(path.join(process.cwd(), 'scripts', 'start-prod.js'), 'utf8');

  it('reads process.env.PORT with a 4100 fallback for local testing', () => {
    expect(src).toContain('process.env.PORT');
    expect(src).toContain("|| '4100'");
  });

  it('spawns the real `next start` command with the resolved port', () => {
    expect(src).toMatch(/spawnSync\(['"]npx['"]/);
    expect(src).toContain("'next'");
    expect(src).toContain("'start'");
    expect(src).toContain("'-p'");
  });

  it('propagates the child process exit code, so a real crash is a real deploy failure', () => {
    expect(src).toMatch(/process\.exit\(result\.status/);
  });

  it('is referenced as the real npm start script, not a stale/orphaned file', () => {
    const pkg = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    expect(pkg.scripts.start).toBe('node scripts/start-prod.js');
  });
});
