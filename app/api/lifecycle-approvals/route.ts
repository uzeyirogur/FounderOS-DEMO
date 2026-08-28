import { NextResponse } from 'next/server';
import { getDb } from '@/lib/data';

export const dynamic = 'force-dynamic';

/** Every pending lifecycle approval across all projects — the "what is
 *  waiting on me" list the Chief of Staff / dashboard surfaces. */
export async function GET() {
  return NextResponse.json({ approvals: getDb().lifecycleApprovals.pending() });
}
