# FounderOS — Production Social Publishing: connector options, costs, and what's implemented

Real code for Instagram, X, and LinkedIn is now wired into `attemptPublishLive`
(`lib/social-publishing.ts`), each behind its own connector module
(`lib/connectors/{instagram,x,linkedin}-publish.ts`). None of them can post
anything without real credentials in `.env.local` (or the other resolved
credential locations, see `lib/creds.ts`) — every one is honestly
`not_configured` until then, verified by real tests
(`tests/social-publish-connectors.test.ts`, `tests/social-publishing-live.test.ts`).

**This document exists so the operator can pick per-platform, one at a time,
with the real cost/effort tradeoffs in front of them — not because any of
this needs to happen tonight.**

## Instagram — Graph API (Meta)

- **What it needs:** a Meta Developer account (free), a Meta app with the
  Instagram API product added, an Instagram **Business or Creator** account
  (not a personal account), a Facebook Page linked to it, and a long-lived
  access token with `instagram_business_content_publish` +
  `instagram_business_basic` scopes.
- **Cost:** **Free.** No per-post charge, no subscription.
- **Approval:** Self-serve for your own account — no partner review needed
  to post to an Instagram account you (or your Page) own. Meta's App Review
  is only required if the app will act on OTHER people's accounts.
- **What's already built:** `lib/connectors/instagram-publish.ts` — the real
  2-step flow (`POST /{ig-user-id}/media` to create a container, then
  `POST /{ig-user-id}/media_publish` to publish it), against the real Graph
  API v21.0 endpoint.
- **Real gap (not a credential gap):** Instagram's API requires a real
  publicly-reachable image/video URL in the request — FounderOS's
  `PublishPlan` schema currently carries only a caption, no media URL. That
  needs a small, real schema addition (a `mediaUrl` field sourced from the
  Content Studio piece's own output) before Instagram posting can go live
  even with credentials. Flagged honestly in the code rather than faked with
  a placeholder image.
- **Env vars needed:** `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_BUSINESS_ACCOUNT_ID`.

## X (formerly Twitter) — API v2

- **What it needs:** an X Developer Portal account and app.
- **Cost:** **Not free as of 2026.** X removed the free posting tier for new
  developers in February 2026. The current default is pay-per-use:
  roughly **$0.015 per plain-text post**, **$0.20 per post containing a
  link** (X's own published rate card). A modest posting cadence (e.g. 20
  posts/month, no links) is under $1/month; heavier volume or link-heavy
  posts add up faster. Legacy $200/month "Basic" plans are closed to new
  signups.
- **Approval:** Fast (same-day to a few days) developer app review; no
  partner program needed to post to your own account.
- **What's already built:** `lib/connectors/x-publish.ts` — real
  `POST /2/tweets`, real Bearer token auth.
- **Env vars needed:** `X_API_BEARER_TOKEN`.
- ⛔ **This is the one platform where enabling it means a real, ongoing,
  small-but-nonzero API bill per post published — needs an explicit "yes,
  spend real money on this" decision before the operator turns it on.**

## LinkedIn — Posts API

- **What it needs:** a LinkedIn Developer app with the **"Share on
  LinkedIn"** product added (self-serve, same-day approval) and OAuth 2.0
  login with the `w_member_social` scope.
- **Cost:** **Free**, for posting to your own personal profile. **150
  requests/member/day, 100,000/app/day** — far more than any realistic
  posting schedule.
- **Approval:** Same-day for your own profile. Posting to a **company page**
  is a separate, harder path (`w_organization_social` via the
  partner-gated Community Management API — a real application, weeks to
  months of review) and is intentionally **not implemented** here.
- **What's already built:** `lib/connectors/linkedin-publish.ts` — real
  `POST /rest/posts` against LinkedIn's current versioned API, reading the
  new post's id from the `x-restli-id` response header (the real, slightly
  unusual place LinkedIn returns it).
- **Env vars needed:** `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_PERSON_URN`.

## Summary table

| Platform  | Cost to post   | Approval difficulty      | Code status |
|-----------|----------------|---------------------------|-------------|
| Instagram | Free           | Self-serve, own account   | Built, needs a real media-URL field added to PublishPlan before it can actually fire |
| X         | ~$0.015–0.20/post (2026 pay-per-use) | Fast, self-serve for own account | Built, ready the moment a token exists — **but each real post has a real, if small, cost** |
| LinkedIn  | Free (own profile) | Same-day, self-serve for own profile; company page needs a partner program | Built, ready the moment a token exists |

## What FounderOS will NOT do automatically

- Never creates a developer account, app, or API key on any platform.
- Never spends money without the operator explicitly turning X on knowing
  it costs real money per post.
- Never posts anything without the existing `PublishPlan` approval gate
  (`draftPublishPlan` → `pending_approval` → operator approves →
  `attemptPublishLive`) — this was true before tonight and is unchanged.
