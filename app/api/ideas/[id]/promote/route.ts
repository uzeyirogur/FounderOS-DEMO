import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/data';
import { ProjectKindSchema, ProjectPermissionLevelSchema, ProjectStatusSchema } from '@/lib/schemas';
import { scoreIdea } from '@/lib/ideas';

export const dynamic = 'force-dynamic';

/**
 * Promotes an idea into a real Project Registry entry — the idea -> project
 * seam of the standard, project-agnostic lifecycle (idea -> research ->
 * validation -> planning -> development -> QA/security/UI review -> launch ->
 * growth/marketing -> monitoring -> iteration -> executive reporting).
 *
 * This is deliberately generic: it does not know or care whether the idea
 * came from researching TIVARO, Is Ilan Radar, or nothing registered yet.
 * The new project starts read_only with zero authorized agents, same as any
 * other Project Registry row — promotion registers a project, it does not
 * grant access.
 */
const PromoteSchema = z.object({
  name: z.string().min(1).max(120),
  kind: ProjectKindSchema,
  pathOrUrl: z.string().min(1).max(500),
  purpose: z.string().max(1000).default(''),
  status: ProjectStatusSchema.default('active'),
  permissionLevel: ProjectPermissionLevelSchema.default('read_only'),
});

/** "İş İlan Radar" -> "is-ilan-radar" (ASCII-fold Turkish chars first, then slugify) */
function slugify(name: string): string {
  const folded = name
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 'S')
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'U')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'O')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C');
  return folded
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const db = getDb();
  const idea = db.ideas.byId(params.id);
  if (!idea) return NextResponse.json({ error: 'idea not found' }, { status: 404 });

  const parsed = PromoteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;

  const base = slugify(input.name) || 'project';
  const taken = new Set(db.projects.all().map((p) => p.id));
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;

  const now = new Date().toISOString();
  const project = {
    ...input,
    id,
    authorizedAgentIds: [] as string[],
    createdAt: now,
    updatedAt: now,
    origin: 'os' as const,
  };
  db.projects.insert(project);

  const updatedIdea = { ...idea, projectId: project.id, updatedAt: now };
  db.ideas.insert(updatedIdea);

  return NextResponse.json({ idea: updatedIdea, score: scoreIdea(updatedIdea), project }, { status: 201 });
}
