import { randomUUID } from 'node:crypto';
import type { openDb } from '@/lib/db';
import { CONTENT_KIND_REQUIREMENT, type ContentKind, type ContentPiece } from '@/lib/schemas';
import type { LlmChatResult } from '@/lib/connectors/llm';
import type { DiscoverCapabilityResult } from '@/lib/capability-discovery';

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

  await deps.discover(db, capability, `${input.kind.replace(/_/g, ' ')} generation tool for: ${input.brief}`);
  const piece: ContentPiece = {
    ...base,
    status: 'needs_capability',
    requiredCapability: capability,
  };
  db.contentPieces.insert(piece);
  return piece;
}
