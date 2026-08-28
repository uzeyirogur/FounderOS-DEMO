import { NextResponse } from 'next/server';
import { getDb } from '@/lib/data';

export const dynamic = 'force-dynamic';

/** Every content piece Social Content Studio has ever produced or attempted. */
export async function GET() {
  return NextResponse.json({ pieces: getDb().contentPieces.all() });
}
