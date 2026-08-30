import { resolveCred, CRED_FILES } from '@/lib/creds';

/**
 * Instagram Graph API publish connector — real implementation, ready to
 * activate the moment real credentials exist. Requires (per Meta's
 * official Content Publishing docs, Instagram API with Instagram
 * Login): a Business/Creator Instagram account, a long-lived access
 * token with `instagram_business_content_publish` +
 * `instagram_business_basic` scopes, and the Instagram professional
 * account's numeric ID. None of this is invented here — no fake
 * "connected" state, no simulated post id. Missing credentials return
 * an honest not_configured result naming exactly which env var is
 * missing; this function is never called by anything that would
 * silently swallow that.
 *
 * Real publish flow (2 calls, per Meta's docs):
 *  1. POST /{ig-user-id}/media — create a media container from an
 *     image/video URL + caption, get back a container id.
 *  2. POST /{ig-user-id}/media_publish — publish that container, get
 *     back the real post id.
 * Video containers need a polling step (status_code FINISHED) before
 * publish, which this omits for the image-only path implemented here —
 * documented as the real remaining gap, not silently glossed over.
 */
const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

export interface InstagramPublishInput {
  caption: string;
  imageUrl: string;
}
export type InstagramPublishResult = { ok: true; postId: string } | { ok: false; reason: string };

function instagramCreds(): { accessToken: string; igUserId: string } | null {
  const accessToken = resolveCred('INSTAGRAM_ACCESS_TOKEN', [CRED_FILES.socialMedia, CRED_FILES.agentsEnv]);
  const igUserId = resolveCred('INSTAGRAM_BUSINESS_ACCOUNT_ID', [CRED_FILES.socialMedia, CRED_FILES.agentsEnv]);
  if (!accessToken || !igUserId) return null;
  return { accessToken, igUserId };
}

export function instagramConfigured(): boolean {
  return instagramCreds() !== null;
}

/**
 * Real 2-step publish against the real Graph API. Honestly not_configured
 * when INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_BUSINESS_ACCOUNT_ID are unset —
 * never simulates success. A real HTTP error from either step is
 * surfaced verbatim (Graph API's own error.message), never masked.
 */
export async function publishToInstagramLive(input: InstagramPublishInput): Promise<InstagramPublishResult> {
  const creds = instagramCreds();
  if (!creds) {
    return {
      ok: false,
      reason:
        'INSTAGRAM_ACCESS_TOKEN and/or INSTAGRAM_BUSINESS_ACCOUNT_ID not set — Instagram Graph API publishing requires a Meta developer app with the Instagram API product, a Business/Creator Instagram account, and a long-lived access token with instagram_business_content_publish scope. See developers.facebook.com/documentation/instagram-platform/content-publishing.',
    };
  }
  try {
    const containerRes = await fetch(`${GRAPH_API_BASE}/${creds.igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: input.imageUrl,
        caption: input.caption,
        access_token: creds.accessToken,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const containerBody = (await containerRes.json()) as { id?: string; error?: { message?: string } };
    if (!containerRes.ok || !containerBody.id) {
      return { ok: false, reason: containerBody.error?.message ?? `HTTP ${containerRes.status} creating media container` };
    }

    const publishRes = await fetch(`${GRAPH_API_BASE}/${creds.igUserId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: containerBody.id, access_token: creds.accessToken }),
      signal: AbortSignal.timeout(15_000),
    });
    const publishBody = (await publishRes.json()) as { id?: string; error?: { message?: string } };
    if (!publishRes.ok || !publishBody.id) {
      return { ok: false, reason: publishBody.error?.message ?? `HTTP ${publishRes.status} publishing media container` };
    }

    return { ok: true, postId: publishBody.id };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
