import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/data';
import { ProjectKindSchema, ProjectPermissionLevelSchema, ProjectStatusSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/**
 * The Project Registry. GET lists every project agents may act on; POST adds
 * one from inside the OS (the /projects form, or later Project Bootstrap
 * proposing a new repo after the operator approves it).
 *
 * Registering a project grants NO access by itself: authorizedAgentIds
 * defaults to empty, so an agent must be explicitly named before it may act
 * on it (mirrors the lead-magnets origin contract — rows created here are
 * stamped origin 'os' and survive a re-seed).
 */
const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  kind: ProjectKindSchema,
  pathOrUrl: z.string().min(1).max(500),
  purpose: z.string().max(1000).default(''),
  status: ProjectStatusSchema.default('active'),
  permissionLevel: ProjectPermissionLevelSchema.default('read_only'),
  authorizedAgentIds: z.array(z.string().min(1)).default([]),
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

export async function GET() {
  return NextResponse.json({ projects: getDb().projects.all() });
}

export async function POST(req: Request) {
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
  const db = getDb();

  const base = slugify(input.name) || 'project';
  const taken = new Set(db.projects.all().map((p) => p.id));
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;

  const now = new Date().toISOString();
  const row = {
    ...input,
    id,
    createdAt: now,
    updatedAt: now,
    origin: 'os' as const,
  };
  db.projects.insert(row);
  return NextResponse.json({ project: row }, { status: 201 });
}
