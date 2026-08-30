import type { openDb } from '@/lib/db';
import { sendWhatsAppTemplateLive, whatsappCloudConfigured } from '@/lib/connectors/whatsapp-cloud-send';

type Db = ReturnType<typeof openDb>;

/**
 * The outbound delivery worker described in
 * docs/WHATSAPP_CHANNEL_ARCHITECTURE.md's "What is architecture-only"
 * section — now real code, not just a design doc. Polls
 * db.notifications.pending() for channel:'whatsapp' rows and sends each
 * one as a real WhatsApp Business Cloud API template message, then
 * marks it sent/failed for real. Never invents a template name or
 * auto-provisions one — WHATSAPP_REPORT_TEMPLATE_NAME must name a
 * template already approved in Meta Business Manager.
 *
 * A local:'local' notification is never touched here — it's already
 * fully visible on /notifications with zero WhatsApp involvement (see
 * the architecture doc's "why the queue is useful even before either
 * piece exists").
 */
export interface WhatsAppDeliveryResult {
  attempted: number;
  sent: string[]; // notification ids
  failed: { id: string; reason: string }[];
  skipped: string | null; // a single honest reason when nothing could be attempted at all
}

export async function runWhatsAppDeliveryTick(db: Db): Promise<WhatsAppDeliveryResult> {
  const pending = db.notifications.pending().filter((n) => n.channel === 'whatsapp');
  if (pending.length === 0) {
    return { attempted: 0, sent: [], failed: [], skipped: null };
  }

  if (!whatsappCloudConfigured()) {
    return {
      attempted: 0,
      sent: [],
      failed: [],
      skipped: `${pending.length} WhatsApp-channel notification(s) pending, but WhatsApp Business Cloud API is not configured — see docs/WHATSAPP_CHANNEL_ARCHITECTURE.md.`,
    };
  }

  const to = process.env.WHATSAPP_REPORT_TO;
  const templateName = process.env.WHATSAPP_REPORT_TEMPLATE_NAME;
  const languageCode = process.env.WHATSAPP_REPORT_TEMPLATE_LANG ?? 'en_US';
  if (!to || !templateName) {
    return {
      attempted: 0,
      sent: [],
      failed: [],
      skipped: 'WHATSAPP_REPORT_TO and/or WHATSAPP_REPORT_TEMPLATE_NAME not set — credentials exist but the destination number and approved template name are still required.',
    };
  }

  const sent: string[] = [];
  const failed: { id: string; reason: string }[] = [];
  for (const notification of pending) {
    // Body variable order matches a real template designed with two
    // {{1}}/{{2}} placeholders (title, body) — the actual template text
    // itself must be authored and approved in Meta Business Manager
    // before this can succeed; this is real client code, not a stand-in.
    const result = await sendWhatsAppTemplateLive({
      to,
      templateName,
      languageCode,
      bodyParams: [notification.title, notification.body],
    });
    if (result.ok) {
      db.notifications.markSent(notification.id);
      sent.push(notification.id);
    } else {
      db.notifications.markFailed(notification.id);
      failed.push({ id: notification.id, reason: result.reason });
    }
  }

  return { attempted: pending.length, sent, failed, skipped: null };
}
