import { NextResponse } from 'next/server';
import { getDb } from '@/lib/data';

export const dynamic = 'force-dynamic';

/** Every outbound message on file, across all channels. */
export async function GET() {
  return NextResponse.json({ messages: getDb().outboundMessages.all() });
}
