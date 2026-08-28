import { NextResponse } from 'next/server';
import { getDb } from '@/lib/data';
import { buildOvernightReport } from '@/lib/agents/overnight-report';

export const dynamic = 'force-dynamic';

/**
 * The real overnight report — completed/failed delegated tasks, pending
 * lifecycle approvals, capabilities awaiting credential/approval, and
 * every project's current lifecycle phase. Pass ?format=markdown for the
 * rendered digest instead of the structured JSON.
 */
export async function GET(req: Request) {
  const report = buildOvernightReport(getDb());
  const format = new URL(req.url).searchParams.get('format');
  if (format === 'markdown') {
    return new NextResponse(report.toMarkdown(), { headers: { 'Content-Type': 'text/markdown' } });
  }
  return NextResponse.json({ report });
}
