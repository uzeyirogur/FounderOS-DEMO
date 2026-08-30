import { resolveCred, CRED_FILES } from '@/lib/creds';

/**
 * X (formerly Twitter) API v2 publish connector. As of 2026, X moved to
 * pay-per-use pricing for new developers (no free tier for posting) —
 * this connector is real code, ready to activate, but using it means a
 * real per-post charge on X's side (roughly $0.015/post without a link,
 * $0.20/post with one, per X's published rate card). This module never
 * calls the API unless XI is explicitly configured AND the operator has
 * approved the spend — see docs/PRODUCTION_SOCIAL_PUBLISHING.md.
 */
const X_API_BASE = 'https://api.x.com/2';

export interface XPublishInput {
  text: string;
}
export type XPublishResult = { ok: true; postId: string } | { ok: false; reason: string };

function xCreds(): { bearerToken: string } | null {
  const bearerToken = resolveCred('X_API_BEARER_TOKEN', [CRED_FILES.socialMedia, CRED_FILES.agentsEnv]);
  if (!bearerToken) return null;
  return { bearerToken };
}

export function xConfigured(): boolean {
  return xCreds() !== null;
}

/** Real POST /2/tweets. Honest not_configured when X_API_BEARER_TOKEN is
 *  unset. X's 2026 pay-per-use model means every real call here has a
 *  real cost — the caller is responsible for having gotten explicit
 *  operator approval for that spend before this is ever invoked live. */
export async function publishToXLive(input: XPublishInput): Promise<XPublishResult> {
  const creds = xCreds();
  if (!creds) {
    return {
      ok: false,
      reason:
        'X_API_BEARER_TOKEN not set — X API v2 posting requires a developer app on the X Developer Portal and, as of 2026, real pay-per-use credits (no free posting tier for new developers; ~$0.015/post plain text, ~$0.20/post with a link). See developer.x.com and confirm spend approval before enabling.',
    };
  }
  try {
    const res = await fetch(`${X_API_BASE}/tweets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.bearerToken}` },
      body: JSON.stringify({ text: input.text }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json()) as { data?: { id?: string }; errors?: { message?: string }[]; detail?: string };
    if (!res.ok || !body.data?.id) {
      return { ok: false, reason: body.errors?.[0]?.message ?? body.detail ?? `HTTP ${res.status} posting to X` };
    }
    return { ok: true, postId: body.data.id };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
