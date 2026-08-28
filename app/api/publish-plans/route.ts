import { NextResponse } from 'next/server';
import { getDb } from '@/lib/data';

export const dynamic = 'force-dynamic';

/** Every publish plan on file, across all content pieces. */
export async function GET() {
  return NextResponse.json({ plans: getDb().publishPlans.all() });
}
