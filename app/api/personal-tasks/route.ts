import { NextResponse } from 'next/server';
import { getDb } from '@/lib/data';

export const dynamic = 'force-dynamic';

/** Every personal task on file — Alex's own, separate from any project. */
export async function GET() {
  return NextResponse.json({ tasks: getDb().personalTasks.all() });
}
