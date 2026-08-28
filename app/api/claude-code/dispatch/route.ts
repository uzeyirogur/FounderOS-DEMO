import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/data';
import { queueClaudeCodeRun } from '@/lib/claude-code-queue';
import { buildDispatchPrompt } from '@/lib/claude-code-dispatch';
import { detectProjectStack } from '@/lib/project-bootstrap';
import { getOrCreateLifecycleState } from '@/lib/project-lifecycle-orchestrator';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  projectId: z.string().min(1),
  goal: z.string().min(1),
});

/**
 * Queues a real Claude Code dispatch — never runs it immediately. This is
 * the safe, zero-cost half of the pipeline: authorization is checked, a
 * real prompt is built from real project context (stack + lifecycle
 * phase), and a ClaudeCodeRun row is created. A full_with_approval-tier
 * project queues as 'awaiting_approval' and needs a separate approve call;
 * read_only/auto_safe_write queue as 'queued', ready for
 * /api/claude-code/runs/[id]/execute — the one route that actually spends
 * money, and only on an explicit follow-up call.
 */
export async function POST(req: Request) {
  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

  const db = getDb();
  const project = db.projects.byId(body.data.projectId);
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

  const stack = detectProjectStack(project.pathOrUrl);
  const lifecycle = getOrCreateLifecycleState(db, project.id);
  const prompt = buildDispatchPrompt({ goal: body.data.goal, stackNote: stack.note, lifecyclePhase: lifecycle.currentPhase });

  const run = queueClaudeCodeRun(db, {
    projectId: project.id,
    projectDir: project.pathOrUrl,
    prompt,
    permissionLevel: project.permissionLevel,
  });
  return NextResponse.json({ run }, { status: 201 });
}

/** Every queued Claude Code run, optionally filtered to one project. */
export async function GET(req: Request) {
  const db = getDb();
  const projectId = new URL(req.url).searchParams.get('projectId');
  const runs = projectId ? db.claudeCodeRuns.byProjectId(projectId) : db.claudeCodeRuns.all();
  return NextResponse.json({ runs });
}
