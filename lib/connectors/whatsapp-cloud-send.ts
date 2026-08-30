import { resolveCred, CRED_FILES } from '@/lib/creds';

/**
 * WhatsApp Business Cloud API (Meta) outbound send connector — real
 * implementation, ready to activate the moment real credentials exist.
 * This is a SEND-only connector for the executive-report/alert/approval
 * channel described in docs/WHATSAPP_CHANNEL_ARCHITECTURE.md — unrelated
 * to lib/connectors/whatsapp.ts (the macOS desktop-app ChatStorage.sqlite
 * READER, which stays untouched).
 *
 * Real requirements per Meta's own WhatsApp Business Platform docs:
 *  - A Meta Business account and a WhatsApp Business Account (WABA).
 *  - A phone number registered to the WABA (cannot already be active on
 *    the consumer WhatsApp/Business app).
 *  - A permanent access token (System User token, not the 24h test
 *    token) with whatsapp_business_messaging permission.
 *  - The Cloud API's own Phone Number ID (not the phone number itself)
 *    to address the send-from number.
 *  - Sending outside the 24-hour customer-service window requires a
 *    pre-approved message template — sending free-form text to a number
 *    that has not messaged you in the last 24h will be REJECTED by Meta.
 *    For an executive-report/alert channel (business-initiated, no
 *    incoming message to open the window), this means a template must
 *    be created and approved in Meta Business Manager before this
 *    connector can send anything for real — documented honestly below,
 *    not worked around with an invented template name.
 */
const WHATSAPP_API_BASE = 'https://graph.facebook.com/v21.0';

export interface WhatsAppTemplateMessageInput {
  /** E.164 phone number to send to, e.g. "+15551234567". */
  to: string;
  /** The name of a template already approved in Meta Business Manager —
   *  this connector cannot invent or auto-create one. */
  templateName: string;
  /** Template language code, e.g. "en_US". */
  languageCode: string;
  /** Ordered body variable values, if the template has {{1}}, {{2}}, etc. */
  bodyParams?: string[];
}
export type WhatsAppSendResult = { ok: true; messageId: string } | { ok: false; reason: string };

function whatsappCloudCreds(): { accessToken: string; phoneNumberId: string } | null {
  const accessToken = resolveCred('WHATSAPP_CLOUD_ACCESS_TOKEN', [CRED_FILES.socialMedia, CRED_FILES.agentsEnv]);
  const phoneNumberId = resolveCred('WHATSAPP_CLOUD_PHONE_NUMBER_ID', [CRED_FILES.socialMedia, CRED_FILES.agentsEnv]);
  if (!accessToken || !phoneNumberId) return null;
  return { accessToken, phoneNumberId };
}

export function whatsappCloudConfigured(): boolean {
  return whatsappCloudCreds() !== null;
}

/**
 * Real POST to the WhatsApp Cloud API's /messages endpoint using a
 * pre-approved message TEMPLATE (required for any business-initiated
 * message outside a 24h customer-service window — which an executive
 * report/alert always is, since the operator did not just message the
 * bot). Honest not_configured when credentials are missing; a real Meta
 * API error (e.g. "template not found/approved") is surfaced verbatim,
 * never masked as success.
 */
export async function sendWhatsAppTemplateLive(input: WhatsAppTemplateMessageInput): Promise<WhatsAppSendResult> {
  const creds = whatsappCloudCreds();
  if (!creds) {
    return {
      ok: false,
      reason:
        "WHATSAPP_CLOUD_ACCESS_TOKEN and/or WHATSAPP_CLOUD_PHONE_NUMBER_ID not set — the WhatsApp Business Cloud API requires a Meta Business account, a WhatsApp Business Account (WABA) with a registered phone number, and a permanent System User access token. See developers.facebook.com/documentation/business-messaging/whatsapp for setup. This is a paid-by-conversation channel once volume grows beyond Meta's free tier; confirm the operator has approved this before enabling.",
    };
  }
  try {
    const res = await fetch(`${WHATSAPP_API_BASE}/${creds.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.accessToken}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: input.to,
        type: 'template',
        template: {
          name: input.templateName,
          language: { code: input.languageCode },
          ...(input.bodyParams && input.bodyParams.length > 0
            ? { components: [{ type: 'body', parameters: input.bodyParams.map((text) => ({ type: 'text', text })) }] }
            : {}),
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json()) as { messages?: { id?: string }[]; error?: { message?: string } };
    if (!res.ok || !body.messages?.[0]?.id) {
      return { ok: false, reason: body.error?.message ?? `HTTP ${res.status} sending WhatsApp template message` };
    }
    return { ok: true, messageId: body.messages[0].id };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
