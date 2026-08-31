# FounderOS — Production Deployment (Railway)

**Live URL:** `https://founder-os-production-859c.up.railway.app`
(behind the access gate — see below)

**Provider:** Railway (`founder-os` project, `production` environment,
service `founder-os`). Chosen because the repo was already written with
Railway in mind (README.md, `.env.example`, `lib/creds.ts` env-var-first
design) — no new architecture needed.

## What's running

- Real Next.js production build (`next build` + `next start`), on Railway's
  Nixpacks builder, `railway.json` config (`startCommand: npm start`,
  `healthcheckPath: /api/health`, `restartPolicyType: ON_FAILURE`,
  `restartPolicyMaxRetries: 10`).
- A persistent volume (`founder-os-volume`, 500MB) mounted at `/data`.
  `FOUNDER_OS_DB=/data/founder-os.db` — the SQLite file survives restarts
  and redeploys (verified: a manual `railway service restart` came back
  online with `uptimeSeconds:0` but the same 37 agents / same data intact).
- The in-process scheduler (`FOUNDER_OS_INPROCESS_SCHEDULER=1`) — no
  external ticker needed. Confirmed live in Railway logs: `[scheduler]
  in-process scheduler started` on boot, and real cron fires (`[scheduler]
  tick fired: cron-conductor-lifecycle-review, cron-conductor-health`)
  with the resulting agent runs showing up in a real
  `GET /api/overnight-report`.
- The access gate (`FOUNDER_OS_ACCESS_TOKEN` set) — every route except
  `/api/health` requires the token (via `?token=...` once, then an
  httpOnly cookie for 30 days). Verified: every page returns 401 without
  it, 200 with it; `/api/health` returns 200 either way (a hosting
  platform's own liveness probe must never be gated).

## Real bugs found and fixed during this deployment

1. **better-sqlite3 native crash** (`Assertion failed: (env) != nullptr`,
   `RemoveEnvironmentCleanupHook`) — the Command Center page crashed the
   whole Node process on every real request under Railway's container
   scheduling. A known upstream bug in better-sqlite3 <=12.x (its
   `node::ObjectWrap`-based native bindings). Fixed by upgrading to
   `^13.0.3` (migrated to node-addon-api, structurally removes the crash
   path). Never reproduced in local dev — only surfaced under real
   production traffic.
2. **QA/security review environment leak** — `runQaReviewLive`/
   `runNpmAuditLive` spawned child processes without setting `env`, so
   they inherited the calling process's `NODE_ENV` (development, when
   FounderOS itself runs via `npm run dev`). This made every QA/security
   review triggered through the live app a false negative. Fixed by
   explicitly setting `NODE_ENV=production` on the spawned child's
   environment.

Both are documented in detail in their own commit messages
(`git log --oneline` on `founder-os`, search "critical fix").

## Environment variables set in Railway (production)

| Variable | Purpose | Set? |
|---|---|---|
| `FOUNDER_OS_ACCESS_TOKEN` | Access-gate token (rotated once after an accidental shell-debug exposure during this session; current value never printed anywhere) | Yes |
| `FOUNDER_OS_DB` | `/data/founder-os.db` — points SQLite at the persistent volume | Yes |
| `FOUNDER_OS_INPROCESS_SCHEDULER` | `1` — enables the in-process scheduler | Yes |
| `NODE_ENV` | `production` | Yes |
| `BRAVE_SEARCH_API_KEY` | Web research (Product & Competitor Research, AI Intelligence discovery, Growth & Marketing, Ad/Creative Research) | **Yes** (2026-08-31) — Alex's existing key, copied verbatim (not rotated, Alex's explicit call). Verified live: `product-competitor-research` agent run returns `ok:true` / "Brave Search API key valid." |
| `GITHUB_TOKEN` | AI Intelligence repo/release discovery | **Yes** (2026-08-31) — Alex's existing fine-grained PAT, copied verbatim (not rotated). Verified live: `ai-intelligence` agent run returns `ok:true` / "Token valid · 5000/5000 API calls remaining this hour." |
| `AI_GATEWAY_API_KEY`, `ANKA_ADMIN_TOKEN`/`ANKA_ADMIN_BASE_URL`, social/WhatsApp publish credentials | Agent chat (LLM Gateway), ANKA Operations, social publishing, WhatsApp | **Not yet copied to production** — ANKA Operations is deliberately DEFERRED this sprint (product/venture priority instead — see docs/PRODUCTION_SOCIAL_PUBLISHING.md and docs/WHATSAPP_CHANNEL_ARCHITECTURE.md for the other two). |

### Priority-9 sprint: real production research chain (2026-08-31)

Both credentials above were set via `railway variables --set` (values piped from
`.env.local` through a temp file that was read but never printed to any log or
chat output), then the service was **redeployed** (`railway redeploy --yes`) —
a plain `service restart` reuses the already-built container image and does
**not** pick up new variables; only a redeploy re-snapshots env into the
running process. Confirmed by three real production actions on the redeployed
instance:

1. **Real SaaS competitor research** — a real test project
   (`ai-meeting-notes-saas-test`) was registered via `POST /api/projects`, then
   `POST /api/growth-briefs/research` ran two real Brave Search queries against
   it ("AI meeting notes SaaS competitors 2026" and "...pricing plans monthly
   comparison"). Real, current (2026) competitor names, prices, and strengths
   came back with real source URLs (Otter.ai, Fireflies, Fathom, Granola,
   Avoma, tl;dv, and others) — stored as real `GrowthBrief` rows, not invented.
2. **AI Intelligence capability discovery** — `POST /api/capabilities/discover`
   for `meeting-transcription-diarization` returned 3 real candidates
   (AssemblyAI, Recall.ai, Speechmatics) with real URLs, added to the
   Capability Registry as `status: candidate` — none auto-activated
   (`approvedByUser: false` on all three), matching the "never activate a
   paid service automatically" rule.
3. **Project Lifecycle research phase** — the test project's lifecycle state
   was advanced `idea -> research -> validation` via
   `POST /api/projects/{id}/lifecycle/advance`, with the two GrowthBriefs above
   as the real artifacts backing the `research` phase. Honest note: `research`
   and `validation` are judgment-call phases in `PHASE_EXIT_EVIDENCE` (no
   `PhaseEvidenceKind` gate — unlike `implementation`/`qa`/`security`/`ui_ux`/
   `launch_readiness`, which do require a passing evidence row to leave), so
   the advance itself did not require the briefs; they are the real research
   record justifying the decision, not a machine-enforced gate.

ANKA Operations was not touched this sprint — remains local/read-only only,
per Alex's explicit priority call.

## Operational commands

```bash
# Link the CLI to this project/service (already linked in this session)
railway status

# Deploy the current local working tree (does NOT deploy from GitHub —
# uploads and builds the local directory directly)
railway up --detach --ci -y

# View live logs
railway logs

# Restart the running container (Railway's own restart, not a redeploy)
railway service restart --yes

# Real backup (run the same backup script locally against a copy of the
# production DB if ever pulled down; SSH-based remote backup was attempted
# this session and blocked on Railway's SSH proxy taking too long to
# connect — not yet a working remote path, documented as a real gap)
npm run backup
npm run restore -- <path-to-backup.db>
```

## Real gaps / honest remaining work

1. **Remote backup via `railway ssh` did not complete in this session** —
   the SSH connection attempt (`railway ssh "npm run backup"`) hung past a
   reasonable wait twice and was abandoned rather than left running
   indefinitely. **This is now closed by option (b) below, which WAS
   verified live**: `POST /api/admin/backup` was called against the real
   production deployment and produced a real 593920-byte backup file at
   `/data/backups/founder-os-2026-08-30T22-45-20-223Z.db` on the
   persistent volume, with the server staying healthy immediately after.
   The `railway ssh` path remains a real gap for anyone who specifically
   wants a copy of that file off the Railway host (the volume itself is
   not directly downloadable via this route) — a future session could add
   either a real download endpoint (careful: this is the whole database,
   gate it tightly) or retry the SSH path with a longer timeout.
2. **Production has none of the optional integration credentials** copied
   over (Brave Search, AI Gateway, GitHub, ANKA Operations, social
   publish, WhatsApp) — every one of those agents/connectors will report
   honest `not_configured` in production right now, exactly as designed.
   Copying any of them is a deliberate operator decision, not something
   this session did unilaterally.
3. **Railway's deprecation warning**: `railway.json`/Config-as-Code is
   deprecated in favor of `.railway/railway.ts` (Infrastructure as Code).
   Existing `railway.json` keeps working until 2026-12-01 per Railway's
   own message — a real, dated migration deadline, not urgent tonight.
