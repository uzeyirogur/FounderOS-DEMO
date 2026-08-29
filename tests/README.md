# Tests

`tests/*.test.ts` — Vitest unit/integration tests (`npm test`). Windows note:
2 known EBUSY failures on `afterEach` temp-dir cleanup
(`project-registry-id-route.test.ts`, `scheduler-tick-route.test.ts`) — a
pre-existing environmental flake (Windows file-lock timing on
`fs.rmSync`), not a real assertion failure. Always confirmed non-regression
by checking the actual assertion count, not just "N failed".

## `tests/e2e/` — Playwright (real browser)

Real-browser smoke coverage over the operator's priority screens (`npx
playwright test`). Config: `playwright.config.ts`.

**Deliberately does NOT start its own dev server.** This repo runs a
long-lived dev server on `:4100` that other concurrent Claude/Codex
sessions and the user's own Startup-folder keepalive script depend on (see
`AGENTS.md`: "Don't kill the dev server on 4100 or 4101"). Playwright tests
assume `:4100` is already up — start it with `npm run dev` first if it
isn't, and never let Playwright's `webServer` option manage it (that would
race other sessions for the port).

Runs both `desktop` (1440×900) and `mobile` (Pixel 7) projects — real
layout bugs only show up at one width or the other, not both.
