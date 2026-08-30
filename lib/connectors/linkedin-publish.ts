import { resolveCred, CRED_FILES } from '@/lib/creds';

/**
 * LinkedIn Posts API publish connector — real implementation for
 * publishing to the AUTHENTICATED MEMBER's own profile (Share on
 * LinkedIn product, `w_member_social` scope). This is the free,
 * same-day-approval path per LinkedIn's own developer docs — posting to
 * a COMPANY PAGE needs `w_organization_social` via the Community
 * Management API, a separate partner-gated program with a real
 * application and weeks-to-months review; that path is intentionally
 * NOT implemented here (see docs/PRODUCTION_SOCIAL_PUBLISHING.md).
 */
const LINKEDIN_API_BASE = 'https://api.linkedin.com/rest/posts';
const LINKEDIN_API_VERSION = '202601'; // LinkedIn-Version header, YYYYMM

export interface LinkedInPublishInput {
  text: string;
}
export type LinkedInPublishResult = { ok: true; postId: string } | { ok: false; reason: string };

function linkedinCreds(): { accessToken: string; personUrn: string } | null {
  const accessToken = resolveCred('LINKEDIN_ACCESS_TOKEN', [CRED_FILES.socialMedia, CRED_FILES.agentsEnv]);
  const personUrn = resolveCred('LINKEDIN_PERSON_URN', [CRED_FILES.socialMedia, CRED_FILES.agentsEnv]);
  if (!accessToken || !personUrn) return null;
  return { accessToken, personUrn };
}

export function linkedinConfigured(): boolean {
  return linkedinCreds() !== null;
}

/** Real POST to LinkedIn's versioned Posts API. Honest not_configured
 *  when LINKEDIN_ACCESS_TOKEN / LINKEDIN_PERSON_URN are unset. */
export async function publishToLinkedInLive(input: LinkedInPublishInput): Promise<LinkedInPublishResult> {
  const creds = linkedinCreds();
  if (!creds) {
    return {
      ok: false,
      reason:
        'LINKEDIN_ACCESS_TOKEN and/or LINKEDIN_PERSON_URN not set — LinkedIn posting to your own profile requires a LinkedIn Developer app with the "Share on LinkedIn" product (w_member_social scope, same-day approval, free) and OAuth 2.0. Posting to a COMPANY PAGE additionally requires w_organization_social via the partner-gated Community Management API (weeks-to-months review) — not implemented here. See learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin.',
    };
  }
  try {
    const res = await fetch(LINKEDIN_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creds.accessToken}`,
        'LinkedIn-Version': LINKEDIN_API_VERSION,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author: creds.personUrn,
        commentary: input.text,
        visibility: 'PUBLIC',
        distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    // LinkedIn returns the new post's URN in the x-restli-id / x-linkedin-id
    // response header, not the JSON body, on a successful 201.
    const postId = res.headers.get('x-restli-id') ?? res.headers.get('x-linkedin-id');
    if (!res.ok || !postId) {
      const body = await res.json().catch(() => ({}) as { message?: string });
      return { ok: false, reason: (body as { message?: string }).message ?? `HTTP ${res.status} posting to LinkedIn` };
    }
    return { ok: true, postId };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
