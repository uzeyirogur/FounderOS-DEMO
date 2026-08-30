# WhatsApp Reporting & Approval Channel — Architecture

**Status (updated, production go-live sprint): the real outbound delivery
worker now exists in code — `lib/connectors/whatsapp-cloud-send.ts` +
`lib/whatsapp-delivery.ts`, wired into the in-process scheduler. It is
honestly `not_configured` until real WhatsApp Business Cloud API credentials
exist. No WhatsApp account is connected. Nothing sends or receives a single
real WhatsApp message today — the code is ready, the account is not. Alex
has not been asked for, and has not supplied, any WhatsApp credentials,
phone number, or Business API account. This is deliberate: the rule from
day one has been "never connect Gmail, WhatsApp, social, or payment
accounts without explicit approval." The inbound decision parser (section
2 below) remains architecture-only.**

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
  `insert()`, `markSent()`, `markFailed()`, `decide()`.
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

### 1. Outbound delivery worker — NOW REAL CODE

`lib/connectors/whatsapp-cloud-send.ts` implements the real WhatsApp
Business Cloud API send call (`POST /{phone-number-id}/messages` with a
`template` message type, per Meta's own docs — a business-initiated message
outside the 24h customer-service window MUST use a pre-approved template,
this is not optional). `lib/whatsapp-delivery.ts`'s `runWhatsAppDeliveryTick`
polls `db.notifications.pending()` for `channel: 'whatsapp'` rows and sends
each one for real, marking it `sent`/`failed` for real — never fabricated.
Wired into the in-process scheduler (`instrumentation-node.ts`) so it runs
on the same 60s cadence as the agent-cron tick, with zero extra
infrastructure, the moment `FOUNDER_OS_INPROCESS_SCHEDULER=1` is set.

Tests: `tests/whatsapp-delivery.test.ts` (6 real assertions — honest skip
reasons per missing credential/config, real send success, real send
failure, and proof a `local`-channel row is never touched by this worker).

**What it still needs from a real WhatsApp connection, once Alex approves
one:**
- A Meta Business account + WhatsApp Business Account (WABA) with a
  registered phone number (see
  developers.facebook.com/documentation/business-messaging/whatsapp).
- A permanent System User access token with `whatsapp_business_messaging`
  permission.
- **A message template authored and approved in Meta Business Manager**
  (e.g. a two-variable "daily_report_v1" template: `{{1}}` = title,
  `{{2}}` = body) — this connector cannot invent or auto-create a
  template; sending will fail with a real, honest Meta API error until
  one exists.
- Four env vars in `.env.local` (see `.env.example`):
  `WHATSAPP_CLOUD_ACCESS_TOKEN`, `WHATSAPP_CLOUD_PHONE_NUMBER_ID`,
  `WHATSAPP_REPORT_TO`, `WHATSAPP_REPORT_TEMPLATE_NAME`.
- **Real, ongoing cost once volume grows beyond Meta's free tier** —
  conversation-based pricing that varies by category and country (see
  developers.facebook.com/docs/whatsapp/pricing). A low-volume
  executive-report/alert channel (a handful of messages per day to one
  number) is likely to stay within or near the free allotment, but this
  needs the operator's own read of current rates before enabling, not an
  assumption baked into the code.

### 2. Inbound decision parser — still architecture-only

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
This also requires a real inbound webhook (Meta calls YOUR server when a
message arrives) — a public HTTPS URL, which the Railway deployment now
provides, but the webhook handler itself is not yet built.

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
   itself is not that approval — building the architecture AND the real
   send connector was explicitly requested; connecting an account is a
   separate decision this doc calls out as still open).
2. A Meta Business account + WABA + registered phone number (the Business
   Cloud API path — `hermes whatsapp` personal-number/QR-pairing was the
   originally-considered alternative, but the Cloud API is what the real
   connector above implements, since it's the officially-supported,
   webhook-friendly path a deployed server needs).
3. The phone number reports should be sent *to* (`WHATSAPP_REPORT_TO`) and
   an approved message template name (`WHATSAPP_REPORT_TEMPLATE_NAME`).
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

