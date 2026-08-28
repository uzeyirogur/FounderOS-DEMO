import { NextResponse } from 'next/server';
import { getDb } from '@/lib/data';

export const dynamic = 'force-dynamic';

/** Every creative brief on file, across all projects. */
export async function GET() {
  return NextResponse.json({ briefs: getDb().creativeBriefs.all() });
}
