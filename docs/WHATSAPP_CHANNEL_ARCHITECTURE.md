# WhatsApp Reporting & Approval Channel — Architecture

**Status: architecture only. No WhatsApp account is connected. Nothing in
this document, and nothing in the code it describes, sends or receives a
single real WhatsApp message today.** Alex has not been asked for, and has
not supplied, any WhatsApp credentials, phone number, or Business API
account. This is deliberate: the rule from day one has been "never connect
Gmail, WhatsApp, social, or payment accounts without explicit approval."

## What exists today (built, tested, live)

A **channel-agnostic report/approval queue** — the part that has nothing to
do with WhatsApp specifically and everything to do with "how does an agent
tell Alex something, or ask Alex to decide something."

- `lib/schemas.ts` — `NotificationSchema`: `kind` (`daily_report` | `alert` |
  `approval_request`), `agentId`, `title`, `body`, `requiresApproval`,
  `status` (`pending` | `sent` | `approved` | `rejected` | `failed`),
  `channel` (`whatsapp` | `local`), and full audit fields (`sentAt`,
  `decidedAt`, `decidedBy`, `responseText`).
- `lib/db.ts` — `notifications` repo: `all()`, `pending()`, `byId()`,
  `insert()`, `markSent()`, `decide()`.
- `POST /api/notifications` — any agent's `run()` can queue a report or an
  approval request. `executive-reporter` already does this on every run
  (queues a `daily_report`).
- `POST /api/notifications/[id]/decide` — records an approve/reject
  decision. Refuses to decide a `daily_report`/`alert` (422 — informational
  rows cannot be "approved"), refuses a decision without `decidedBy` (every
  decision must be attributable), 404s for an unknown id.
- `/notifications` page — the local UI. Approve/reject buttons call the
  exact same `decide` endpoint a WhatsApp reply handler would call, with
  `decidedBy: 'local-ui'`. **This means the local UI is fully usable as the
  approval channel right now, with zero WhatsApp involvement.**

Tests: `tests/notifications-schema.test.ts`,
`tests/notifications-db.test.ts`, `tests/notifications-route.test.ts`,
`tests/notifications-decide-route.test.ts` — all real, all green.

## What is architecture-only (not built)

Two pieces, both requiring a real WhatsApp account Alex has not connected:

### 1. Outbound delivery worker

A process that polls `GET db.notifications.pending()` and, for rows with
`channel: 'whatsapp'`, sends the `title` + `body` as a WhatsApp message, then
calls `markSent(id)`.

**Design decision: this is a poll loop, not a push.** The queue table
already exists and already has a `status` state machine — adding a delivery
worker is additive (a new consumer of an existing table), not a redesign.
The scheduler engine (`lib/scheduler/tick.ts`) is the natural home: a
delivery tick alongside the existing agent-cron tick, both driven by the
same external ticker (today: a Hermes `cronjob` hitting
`/api/scheduler/tick`; later: an in-process interval on a dedicated host —
see that file's own doc comment for why the calling code does not change
either way).

**What it needs from a real WhatsApp connection**, once Alex approves one:
- `hermes whatsapp` (Baileys/QR pairing, personal account) **or**
  `hermes whatsapp-cloud` (Meta Business Cloud API, requires a Business
  account + public webhook URL) — both already exist as Hermes gateway
  setup commands; FounderOS does not need to implement a WhatsApp client
  from scratch.
- One phone number to send *to* (Alex's own number) stored in `.env.local`
  as `WHATSAPP_REPORT_TO` — never in code, same pattern as every other
  credential in this repo (`lib/creds.ts` convention).

### 2. Inbound decision parser

Something that reads Alex's WhatsApp replies and, when a reply is clearly a
decision on a specific pending `approval_request`, calls
`POST /api/notifications/[id]/decide` with `decidedBy` set to Alex's phone
number and `responseText` set to the raw reply.

**Design decision: parse conservatively, never guess.** A reply like "yes"
sent in a chat with multiple pending approvals is ambiguous — the parser
must either (a) only accept replies that are *replies-to* the specific
WhatsApp message that carried the request (message-threading, if the
adapter supports it), or (b) require the operator to reference the request
by a short id FounderOS includes in the message body (e.g. "approve #a1b2").
**Never** auto-approve on a bare "yes" against "whichever request is
newest" — a race between two pending approvals must not let a reply meant
for one silently decide the other. This is the same class of bug D-169's
service-account design in ANKA+ was built to avoid (no implicit scope).

### Why the queue is useful even before either piece exists

Every report and approval request an agent generates is already durable and
visible today, on the `/notifications` page, with zero WhatsApp
dependency. Connecting WhatsApp later is additive: it adds a delivery path
and an inbound decision path to a queue that already works end-to-end
locally. Nothing about today's local flow needs to change when it does.

## What Alex needs to decide/provide before this activates

None of the below has been requested, asked for, or entered — per the
standing rule.

1. **Explicit approval to connect a WhatsApp channel at all** (this document
   itself is not that approval — building the architecture was explicitly
   requested; connecting an account is a separate decision this doc calls
   out as still open).
2. Which WhatsApp path: `hermes whatsapp` (personal number, QR pairing, free)
   or `hermes whatsapp-cloud` (Meta Business API, needs a Business account
   and a public webhook URL — heavier setup, official/supported path).
3. The phone number reports should be sent *to* (`WHATSAPP_REPORT_TO`).
4. A decision on the inbound parsing strategy above (reply-threading vs.
   short-id reference) — this is a product decision, not just an
   implementation detail, because it changes what Alex has to type back.

## Non-goals

- This is not a general WhatsApp inbox/CRM feature. The existing
  `lib/connectors/whatsapp.ts` (macOS desktop app DB reader, read-only,
  already live) is unrelated and untouched by this design.
- No message content beyond `title`/`body` is ever sent — no attachments,
  no rich formatting, no read receipts tracked.
- No auto-approval logic of any kind. Every `approval_request` row requires
  an explicit human decision through the `decide` endpoint; there is no
  timeout-based default and no "assume yes" path.
