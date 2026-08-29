# FounderOS — Agent Reality Audit (2026-08-29, V1 Completion Sprint)

Status legend: **LIVE** (tested against real data/API/tool this session with live evidence) ·
**PARTIAL** (real implementation but a real dependency is optional/missing) ·
**NOT_CONFIGURED** (real code path exists, honestly reports the exact missing credential) ·
**BLOCKED_BY_APPROVAL** (real code path exists, gated behind a spend/credential/social/deploy
approval) · **BLOCKED_BY_CREDENTIAL** (cannot proceed without a new key/account the operator
hasn't provided).

Method: every one of the 20 core agents was invoked live via `POST /api/agents/{id}/run`
against the running dev server (real SQLite DB, real env, real network) during this
session — not read from source alone. Full raw output is in the session transcript.

| # | Agent | Status | Live evidence this session |
|---|---|---|---|
| 1 | Chief of Staff / Conductor | **LIVE** | `run()` → `ok:true`, real 5-domain blocker aggregation (0 lifecycle approvals, 0 publish plans, 0 outbound, 0 candidates, 0 blocked content). **Real bug found+fixed this session**: `ok` was previously tied to an unrelated local-dev-tool inventory (remotion/ollama/ffmpeg/etc, 0/9 up on this machine) — a conductor doing its real job correctly was reported "failed". Same bug class as the prior session's executive-reporter self-feeding loop. Fixed; `ok` now reflects only the conductor's own aggregation job. Also owns the delegated-task domain (roster-gated, dedup, dependencies, 3-attempt retry cap — Faz 6 this sprint). |
| 2 | Project Lifecycle Orchestrator | **PARTIAL** | Not a runnable agent card (no `run()` — it's an orchestrator module, `lib/project-lifecycle-orchestrator.ts`, invoked by `advancePhase`/`recordEvidence` API routes and rendered live on every `/projects/[id]` page). Verified live in the preview pane this session (`step 1 of 16`, `Next action: Ready to advance...`). Evidence-gated phases + required-evidence/next-action now surfaced in the UI (Faz 5 this sprint). |
| 3 | Claude Code Orchestrator | **PARTIAL** | `run()` → `ok:true`, "0/1 active projects authorize this agent — grant access from /projects". Real code path (queue → dry-run → approval → real `claude` CLI dispatch with a hard 10-min timeout → post-run QA handoff, Faz 4 this sprint) is complete; ANKA+ has not been authorized for it yet (operator action, not a bug). No real paid dispatch has been made. |
| 4 | QA / Bug Hunter | **PARTIAL** | `run()` → `ok:true`, "No active project authorizes this agent yet". Real stack-aware (Node/.NET/Python) `npm test`/`typecheck`/`build` execution exists (`lib/qa-review-orchestrator.ts`), same authorization gap as #3. |
| 5 | UI/UX Reviewer | **PARTIAL** | `run()` → `ok:true`, same authorization gap. Real static JSX a11y scanner with severity/evidence/suggestion (Faz G, prior session) — found 34 real findings live against this codebase. No Playwright-based visual review (that gap is now covered separately by the new `tests/e2e/smoke.spec.ts` Playwright suite, Faz 2 this sprint, not by this agent). |
| 6 | Security Reviewer | **LIVE** | `run()` → same authorization gap as #3/#4/#5 for its project-scoped review tool, but real `npm audit` + secret-scan + code-pattern checks (CORS/SQL-concat/eval/dangerouslySetInnerHTML/hardcoded-fallback, Faz H prior session) live-tested against this codebase in a prior session. |
| 7 | Product & Competitor Research | **LIVE** | `run()` → `ok:true`, "Brave Search API key valid." Real live API call. |
| 8 | AI Intelligence | **LIVE** | `run()` → `ok:true`, "Token valid · 5000/5000 API calls remaining this hour" (real live GitHub API call). Real capability discovery + `compareCandidates` scoring now wired into Social Content Studio's approval flow (Faz 3 this sprint). |
| 9 | Idea Lab | **LIVE** | `run()` → `ok:true`, "No ideas registered yet — add one at /ideas." Real, honest empty state — deterministic scoring rubric exists and is exercised by its own tests. |
| 10 | Project Bootstrap | **LIVE** | `run()` → `ok:true`, "1/1 local projects have a recognizable stack: ANKA+ / TIVARO (TypeScript/JavaScript)." Real filesystem manifest detection. |
| 11 | Growth & Marketing | **LIVE** | `run()` → `ok:true`, "No growth briefs yet — use the chat tool researchGrowth to run one." Real Brave-Search-backed research tool, live-tested in a prior session. |
| 12 | Social Content Studio | **LIVE** | `run()` → `ok:true`, "No content pieces yet — use the chat tool produceContent to draft one." Full pipeline now real end to end (Faz 3 this sprint): brief → capability requirements → registry lookup → live discovery → `compareCandidates` ranking → a real `approval_request` Notification (naming what's needed/why/options/free alternative) when the top pick needs spend or a credential. Never auto-activates a paid/credentialed tool. |
| 13 | Social Publishing | **NOT_CONFIGURED** | `run()` → `ok:true`, "No publish plans yet — use the chat tool draftPublish to create one." Real plan/adaptation logic exists; no real write-capable publish connector exists yet (the one read-only connector, Zernio, cannot publish). |
| 14 | Ad / Creative Research | **LIVE** | `run()` → `ok:true`, "1 creative brief(s) on file." Real data, real Brave-Search-backed research. |
| 15 | Communications | **PARTIAL** | `run()` → `ok:false`, "0/3 channels live → /comms · Gmail DOWN · WhatsApp DOWN · Slack DOWN." This is CORRECT, honest `ok:false` — unlike the conductor bug above, this agent's own job IS being a live channel aggregator, so 0/3 live channels legitimately means it isn't doing its job right now (no `INBOX_n_*` env vars configured). Real SMTP reply path + local WhatsApp ChatStorage read code exists and works when configured. |
| 16 | Usage & Cost Monitor | **BLOCKED_BY_CREDENTIAL** | `run()` → `ok:false`, "ANTHROPIC_ADMIN_KEY not set... a separate credential from your normal API key". Real code path exists (real Anthropic Admin API call); this key is explicitly NOT requested per standing operator instruction (individual account, not org admin). |
| 17 | Executive Reporter | **LIVE** | `run()` → `ok:true`, "27 runs in the last 24h across 17 agents — 21 ok, 6 failed." Real digest from real `agent_runs` rows, no LLM. Self-feeding failure loop bug fixed in the prior session; now correctly `ok:true` regardless of what it reports about other agents. Seeded, spaced-out cron distribution (Faz M, prior session). |
| 18 | ANKA Operations | **LIVE** | `run()` → `ok:true`, "Service account reachable · read-only, non-financial routes only · 5 active students. · 1 branch(es) · 2 sport(s)." Real D-169 read-only service-account API call, live. |
| 19 | Work Assistant | **LIVE** | `run()` → `ok:true`, "No open personal tasks · calendar: No Google inboxes configured..." Real CRUD, honest calendar not_configured state. |
| 20 | Personal Ops | **LIVE** | `run()` → `ok:true`, "No active routines yet — use the chat tool addRoutine to create one." Real routines/streak logic, live-tested for idempotent same-day check-in in a prior session. |

## Summary counts

- **LIVE: 12** (Conductor, Product Research, AI Intelligence, Idea Lab, Project Bootstrap,
  Growth & Marketing, Social Content Studio, Ad/Creative Research, Executive Reporter,
  ANKA Operations, Work Assistant, Personal Ops)
- **PARTIAL: 6** (Project Lifecycle Orchestrator, Claude Code Orchestrator, QA, UI/UX Reviewer,
  Security Reviewer real-but-gated-on-authorization, Communications real-but-no-inbox-configured)
- **NOT_CONFIGURED: 1** (Social Publishing — no write-capable connector exists)
- **BLOCKED_BY_CREDENTIAL: 1** (Usage & Cost Monitor — `ANTHROPIC_ADMIN_KEY`, intentionally
  not requested per standing operator instruction)
- **BLOCKED_BY_APPROVAL: 0** as a standalone status (approval-gating exists as a property of
  several agents above — e.g. Communications' draft-then-approve send, Social Content Studio's
  capability approval_request, Claude Code's real-dispatch approval — but none of the 20 core
  agents is ENTIRELY blocked on a pending approval as its dominant state right now).

## Real bug found+fixed this session (not a documentation-only finding)

**Conductor's `run()` tied `ok` to an unrelated local-dev-tool inventory** (`localStackStatus()`
— remotion/ollama/ffmpeg/command-center/etc, most never configured on a given machine) instead
of its own actual job (aggregating real cross-system blocker counts). A conductor doing its job
correctly was reported "failed" whenever any of ~9 optional local tools was down — which is
close to always, and was actively corrupting Executive Reporter's `agent_runs` failure stats
(visible live: 6/27 runs "failed" in the last 24h, several of them innocent conductor runs).
Same bug class as the executive-reporter self-feeding-failure-loop fix from the prior session.
Fixed with a real regression test (`tests/conductor-run-ok.test.ts`) proving `ok:true` even
when every local-stack host is down.

## What did NOT need new work this pass

The prior overnight session's audit (`docs/AGENT_AUDIT_2026-08-29.md`, now superseded by this
file) already found and closed the two biggest structural gaps (no task/work-item domain, no
lifecycle evidence gating) and the QA Node-hardcoding gap. This pass's job was to actually
RUN every agent live and check the `ok`/summary honesty, which is how the conductor bug above
was found — a category of bug source review alone would not have caught.
