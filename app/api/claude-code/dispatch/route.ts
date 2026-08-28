import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/data';
import { dispatchClaudeCodeLive } from '@/lib/claude-code-dispatch';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  projectId: z.string().min(1),
  prompt: z.string().min(1),
});

/**
 * Dispatches a REAL coding task to the `claude` CLI against a Project
 * Registry-authorized local project. This is a PAID operation against the
 * operator's Anthropic account — the caller is responsible for having
 * confirmed that cost with the operator before hitting this route from an
 * automated flow. 404 unknown project, 422 inactive/non-local project,
 * 403 unauthorized (all free, no cost incurred) — only a fully-authorized
 * request reaches the real claude invocation.
 */
export async function POST(req: Request) {
  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

  const project = getDb().projects.byId(body.data.projectId);
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });
  if (project.status !== 'active') {
    return NextResponse.json({ error: `project is not active (status: ${project.status})` }, { status: 422 });
  }
  if (!project.authorizedAgentIds.includes('claude-code-orchestrator')) {
    return NextResponse.json(
      { error: 'claude-code-orchestrator is not authorized on this project — grant access from /projects first' },
      { status: 403 },
    );
  }
  if (project.kind !== 'local') {
    return NextResponse.json({ error: 'only local projects can be dispatched to on this machine today' }, { status: 422 });
  }

  const result = await dispatchClaudeCodeLive({
    projectDir: project.pathOrUrl,
    prompt: body.data.prompt,
    permissionLevel: project.permissionLevel,
  });
  return NextResponse.json({ result });
}
