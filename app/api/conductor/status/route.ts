import { NextResponse } from 'next/server';
import { getDb } from '@/lib/data';
import { aggregateStatus } from '@/lib/conductor';

export const dynamic = 'force-dynamic';

/** Chief of Staff's real, live cross-system status — every pending
 *  approval and blocker across every domain this build has. */
export async function GET() {
  return NextResponse.json({ status: aggregateStatus(getDb()) });
}
