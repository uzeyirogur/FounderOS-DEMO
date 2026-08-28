import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getDb } from '@/lib/data';
import { NotificationKindSchema, NotificationChannelSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/**
 * The report/approval queue's create+list endpoint. Any real agent (a cron
 * run, a manual chat action) that wants to tell Alex something, or ask Alex
 * to decide something, writes a row here — the delivery worker (WhatsApp
 * today: none wired, see docs/WHATSAPP_CHANNEL_ARCHITECTURE.md) polls
 * GET .../pending separately and marks rows sent.
 *
 * requiresApproval defaults false and is NOT settable independently of kind
 * from the request body for daily_report/alert — only an approval_request
 * can carry it true. This is enforced in code, not just by convention: no
 * route may accidentally grant approval semantics to an informational row.
 */
const CreateSchema = z.object({
  kind: NotificationKindSchema,
  agentId: z.string().min(1),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
  channel: NotificationChannelSchema.default('local'),
});

export async function GET() {
  return NextResponse.json({ notifications: getDb().notifications.all() });
}

export async function POST(req: Request) {
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { kind, agentId, title, body, channel } = parsed.data;
  const now = new Date().toISOString();
  const notification = {
    id: randomUUID(),
    kind,
    agentId,
    title,
    body,
    requiresApproval: kind === 'approval_request',
    status: 'pending' as const,
    channel,
    createdAt: now,
    sentAt: null,
    decidedAt: null,
    decidedBy: null,
    responseText: null,
  };
  getDb().notifications.insert(notification);
  return NextResponse.json({ notification }, { status: 201 });
}
