import { randomUUID } from 'node:crypto';
import type { openDb } from '@/lib/db';
import { CONTENT_KIND_REQUIREMENT, type ContentKind, type ContentPiece } from '@/lib/schemas';
import type { LlmChatResult } from '@/lib/connectors/llm';
import type { DiscoverCapabilityResult } from '@/lib/capability-discovery';
import { compareCandidates } from '@/lib/capability-comparison';

type Db = ReturnType<typeof openDb>;

export interface ProduceContentInput {
  kind: ContentKind;
  brief: string;
  projectId: string | null;
}

/** Injected so this module has zero network dependency in tests — the real
 *  callers (the agent, the API route) pass lib/connectors/llm's chat() and
 *  lib/capability-discovery's discoverCapabilityLive(). */
export interface ProduceContentDeps {
  chat: (req: { system?: string; messages: { role: 'system' | 'user'; content: string }[] }) => Promise<LlmChatResult>;
  discover: (db: Db, capability: string, searchQuery: string) => Promise<DiscoverCapabilityResult>;
}

const TEXT_SYSTEM_PROMPT: Record<'social_post' | 'carousel', string> = {
  social_post:
    'You write a single, ready-to-post social media post from a brief. Output ONLY the post text, no preamble, no quotes, no hashtag spam.',
  carousel:
    'You write the slide-by-slide text for a social media carousel from a brief. Output each slide on its own line as "Slide N: <text>", nothing else.',
};

/**
 * Social Content Studio's real production step — not "write text and call
 * it done". A text-native kind (social_post, carousel) is produced directly
 * by an LLM call. Every other kind needs a real tool: this checks the
 * Capability Registry first (an ACTIVE, approved provider means the piece
 * is producible right now — named by provider so the operator can see what
 * would actually make it), and if nothing is active, runs a live discovery
 * search and returns 'needs_capability' pointing at what to review at
 * /capabilities. Nothing here fabricates media that was not actually made.
 */
export async function produceContentPiece(
  db: Db,
  input: ProduceContentInput,
  deps: ProduceContentDeps,
): Promise<ContentPiece> {
  const now = new Date().toISOString();
  const requirement = CONTENT_KIND_REQUIREMENT[input.kind];
  const id = randomUUID();

  const base: ContentPiece = {
    id,
    projectId: input.projectId,
    kind: input.kind,
    brief: input.brief,
    status: 'drafted',
    output: null,
    requiredCapability: null,
    createdAt: now,
    updatedAt: now,
  };

  if (requirement.textNative) {
    try {
      const result = await deps.chat({
        system: TEXT_SYSTEM_PROMPT[input.kind as 'social_post' | 'carousel'],
        messages: [{ role: 'user', content: input.brief }],
      });
      const piece: ContentPiece = { ...base, status: 'produced', output: result.text };
      db.contentPieces.insert(piece);
      return piece;
    } catch (err) {
      const piece: ContentPiece = {
        ...base,
        status: 'failed',
        output: err instanceof Error ? err.message : String(err),
      };
      db.contentPieces.insert(piece);
      return piece;
    }
  }

  const capability = requirement.capability!;
  const active = db.capabilities.byCapability(capability).filter((c) => c.status === 'active');
  if (active.length > 0) {
    const provider = active[0];
    const piece: ContentPiece = {
      ...base,
      status: 'produced',
      output: `Would be produced via ${provider.name} (${provider.connector ?? capability}) — real invocation happens through that provider's own connector.`,
    };
    db.contentPieces.insert(piece);
    return piece;
  }

  const discovery = await deps.discover(db, capability, `${input.kind.replace(/_/g, ' ')} generation tool for: ${input.brief}`);

  // Compare whatever discovery found (real callers persist candidates to
  // the registry as part of discovery; this reads the result it actually
  // returned so a test double doesn't need to fake DB writes to be
  // exercised) and — only when the best option needs real money or a
  // credential — queue a real approval_request so the operator sees what's
  // needed, why, and whether a free alternative exists. A free, no-auth
  // top candidate never blocks on approval (nothing to approve); an empty
  // comparison (nothing discoverable) never queues an empty ask.
  const ranked = compareCandidates(discovery.candidates);
  const top = ranked[0];
  if (top && (top.costModel === 'paid' || top.costModel === 'freemium' || top.authRequired)) {
    const alternative = ranked.find((c) => c.costModel === 'free' && !c.authRequired && c.id !== top.id);
    const lines = [
      `Content Studio needs a "${capability}" tool to produce "${input.brief}".`,
      `Top option: ${top.name} — ${top.costModel}${top.freeTier ? ` (free tier: ${top.freeTier})` : ''}${top.authRequired ? ', requires a credential' : ''}.`,
      ranked.length > 1
        ? `${ranked.length - 1} other option(s) considered: ${ranked
            .slice(1)
            .map((c) => `${c.name} (${c.costModel})`)
            .join(', ')}.`
        : 'No other options found in this discovery pass.',
      alternative
        ? `A free, no-credential alternative exists: ${alternative.name}.`
        : 'No free/no-credential alternative was found — this needs a real spend or credential decision.',
      `Review and approve at /capabilities before any paid/credentialed tool is used.`,
    ];
    db.notifications.insert({
      id: randomUUID(),
      kind: 'approval_request',
      agentId: 'social-content-studio',
      title: `Capability needed: ${capability}`,
      body: lines.join(' '),
      requiresApproval: true,
      status: 'pending',
      channel: 'local',
      createdAt: now,
      sentAt: null,
      decidedAt: null,
      decidedBy: null,
      responseText: null,
    });
  }

  const piece: ContentPiece = {
    ...base,
    status: 'needs_capability',
    requiredCapability: capability,
  };
  db.contentPieces.insert(piece);
  return piece;
}
