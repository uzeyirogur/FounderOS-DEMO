import { NextResponse } from 'next/server';
import { getDb } from '@/lib/data';

export const dynamic = 'force-dynamic';

/** The full Capability / Tool Registry — every provider any agent has ever
 *  discovered or been given, from bare 'candidate' to 'active'. */
export async function GET() {
  return NextResponse.json({ capabilities: getDb().capabilities.all() });
}
