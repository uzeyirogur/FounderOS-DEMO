import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/data';
import { ProjectKindSchema, ProjectPermissionLevelSchema, ProjectStatusSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/**
 * One project. PATCH edits it (change permission level, add/remove an
 * authorized agent, pause it); DELETE drops it. Both 404 honestly when the
 * id is not there rather than reporting a success that did nothing.
 *
 * id and origin are never editable: the id is what agents key access
 * checks on, and origin is what protects an OS-registered row from a re-seed.
 */
const PatchSchema = z
  .object({
    name: z.string().min(1).max(120),
    kind: ProjectKindSchema,
    pathOrUrl: z.string().min(1).max(500),
    purpose: z.string().max(1000),
    status: ProjectStatusSchema,
    permissionLevel: ProjectPermissionLevelSchema,
    authorizedAgentIds: z.array(z.string().min(1)),
  })
  .partial();

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = getDb();
  const existing = db.projects.byId(params.id);
  if (!existing) return NextResponse.json({ error: 'project not found' }, { status: 404 });

  const updated = {
    ...existing,
    ...parsed.data,
    id: existing.id,
    origin: existing.origin,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  db.projects.insert(updated);
  return NextResponse.json({ project: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const removed = getDb().projects.remove(params.id);
  if (!removed) return NextResponse.json({ error: 'project not found' }, { status: 404 });
  return NextResponse.json({ ok: true, id: params.id });
}
