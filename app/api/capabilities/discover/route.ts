import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/data';
import { discoverCapabilityLive } from '@/lib/capability-discovery';

export const dynamic = 'force-dynamic';

const DiscoverSchema = z.object({
  capability: z.string().min(1).max(80),
  searchQuery: z.string().min(1).max(300),
});

/**
 * Triggers a real discovery pass for one capability tag: checks the
 * registry first, and only searches the web (via AI Intelligence's Brave
 * Search connector) if nothing active exists. Never activates anything —
 * see POST /api/capabilities/[id]/approve for the only path that can.
 */
export async function POST(req: Request) {
  const parsed = DiscoverSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { capability, searchQuery } = parsed.data;
  const result = await discoverCapabilityLive(getDb(), capability, searchQuery);
  return NextResponse.json(result);
}
