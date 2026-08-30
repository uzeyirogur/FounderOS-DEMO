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
| `BRAVE_SEARCH_API_KEY`, `AI_GATEWAY_API_KEY`, `GITHUB_TOKEN`, `ANKA_ADMIN_TOKEN`/`ANKA_ADMIN_BASE_URL`, social/WhatsApp publish credentials | Real integrations (research, agent chat, GitHub status, ANKA Operations, social publishing, WhatsApp) | **Not yet copied to production** — deliberately left for the operator to decide per-credential (see docs/PRODUCTION_SOCIAL_PUBLISHING.md and docs/WHATSAPP_CHANNEL_ARCHITECTURE.md). Local dev has some of these; production intentionally does not yet. |

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
   reasonable wait and was abandoned rather than left running indefinitely.
   The backup CODE itself is real and tested (`tests/backup.test.ts`, run
   locally against the real dev DB — a real 630KB+ backup file, a real
   restore, a real safety-copy-on-overwrite, all verified). What's missing
   is a working REMOTE trigger for it on Railway specifically. Options for
   a future session: (a) retry `railway ssh` with a longer timeout/retry
   loop, (b) add a `/api/admin/backup` route gated behind the access token
   that calls `backupDatabase()` in-process and returns the file (or
   streams it to a configured destination), (c) Railway's own volume
   snapshot feature if the plan tier includes it.
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
