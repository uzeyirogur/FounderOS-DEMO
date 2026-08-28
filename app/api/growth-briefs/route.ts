import { NextResponse } from 'next/server';
import { getDb } from '@/lib/data';

export const dynamic = 'force-dynamic';

/** Every growth research brief on file, across all projects. */
export async function GET() {
  return NextResponse.json({ briefs: getDb().growthBriefs.all() });
}
