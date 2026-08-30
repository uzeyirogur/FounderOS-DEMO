#!/usr/bin/env node
/**
 * Cross-platform production start wrapper. Railway (and most PaaS hosts)
 * inject PORT at runtime and require the app to bind to it — `next start
 * -p ${PORT:-4100}` is bash-only syntax that breaks on Windows (npm start
 * shells out via cmd.exe there, not bash), so this reads process.env.PORT
 * in real Node and falls back to 4100 for local `npm start` testing.
 */
const { spawnSync } = require('node:child_process');

const port = process.env.PORT || '4100';
const result = spawnSync('npx', ['next', 'start', '-p', port], {
  stdio: 'inherit',
  shell: true,
});
process.exit(result.status ?? 1);
