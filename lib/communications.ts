import { randomUUID } from 'node:crypto';
import type { openDb } from '@/lib/db';
import type { OutboundChannel, OutboundMessage } from '@/lib/schemas';

type Db = ReturnType<typeof openDb>;

export interface DraftOutboundMessageInput {
  channel: OutboundChannel;
  to: string;
  subject: string | null;
  body: string;
}

/**
 * Drafts an outbound message to a real inbox or WhatsApp contact.
 * Always starts at 'pending_approval' — per the Approval Policy, a real
 * message to a real person is never sent without an explicit yes first.
 * Same shape/contract as draftPublishPlan in lib/social-publishing.ts.
 */
export function draftOutboundMessage(db: Db, input: DraftOutboundMessageInput): OutboundMessage {
  const msg: OutboundMessage = {
    id: randomUUID(),
    channel: input.channel,
    to: input.to,
    subject: input.subject,
    body: input.body,
    status: 'pending_approval',
    createdAt: new Date().toISOString(),
    decidedAt: null,
    decidedBy: null,
    sentAt: null,
    failureReason: null,
  };
  db.outboundMessages.insert(msg);
  return msg;
}

export type SendFn = (msg: OutboundMessage) => Promise<{ ok: true } | { ok: false; reason: string }>;
export type AttemptSendResult = { ok: true } | { ok: false; reason: string };

/**
 * The ONE function that can move a message to 'sent'. Refuses anything
 * not already 'approved' — a human decision is a precondition, never
 * something this function grants. sendFn is injected (the real SMTP/
 * WhatsApp connector) so a real failure is recorded honestly rather than
 * silently dropped or faked as success.
 */
export async function attemptSend(db: Db, messageId: string, sendFn: SendFn): Promise<AttemptSendResult> {
  const msg = db.outboundMessages.byId(messageId);
  if (!msg) return { ok: false, reason: 'message not found' };
  if (msg.status !== 'approved') {
    return { ok: false, reason: `message is not approved (status: ${msg.status})` };
  }

  const result = await sendFn(msg);
  if (result.ok) {
    db.outboundMessages.markSent(messageId);
    return { ok: true };
  }
  db.outboundMessages.markFailed(messageId, result.reason);
  return result;
}

/**
 * attemptSend wired to the real channel connectors. Email is fully real
 * (lib/connectors/email.ts sendEmailReply — SMTP with configured inbox
 * credentials). WhatsApp is honestly not_configured: lib/connectors/
 * whatsapp.ts only reads the local ChatStorage.sqlite (read-only), it has
 * no outbound send API — one is not invented here.
 */
export async function attemptSendLive(db: Db, messageId: string): Promise<AttemptSendResult> {
  const msg = db.outboundMessages.byId(messageId);
  if (!msg) return { ok: false, reason: 'message not found' };

  if (msg.channel === 'email') {
    return attemptSend(db, messageId, async (m) => {
      const { sendEmailReply } = await import('@/lib/connectors/email');
      const result = await sendEmailReply({ to: m.to, subject: m.subject ?? '(no subject)', text: m.body });
      return result.ok ? { ok: true } : { ok: false, reason: result.error ?? 'send failed' };
    });
  }

  return attemptSend(db, messageId, async () => ({
    ok: false,
    reason:
      'No real WhatsApp send connector is wired yet — lib/connectors/whatsapp.ts only reads the local ChatStorage.sqlite, it has no outbound send API implemented. Approve/reject still work; live WhatsApp sending needs that connector built first.',
  }));
}
