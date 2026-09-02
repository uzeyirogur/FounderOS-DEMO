import type { ConnectorStatus, ConnectorKind } from '@/lib/connectors/types';

const TELEGRAM_API = 'https://api.telegram.org/bot';

export type TelegramMessage = {
  id: number;
  chatId: number;
  chatTitle: string;
  from: string;
  text: string;
  date: Date;
};

export type TelegramSendResult = { ok: boolean; detail: string; messageId?: number };

function getToken(env: Record<string, string | undefined> = process.env): string | null {
  return env.TELEGRAM_BOT_TOKEN || null;
}

export async function telegramStatus(
  env: Record<string, string | undefined> = process.env
): Promise<ConnectorStatus> {
  const token = getToken(env);
  if (!token) {
    return {
      id: 'telegram',
      name: 'Telegram',
      kind: 'orchestration' as ConnectorKind,
      state: 'not_configured',
      detail: 'TELEGRAM_BOT_TOKEN ayarlanmamis. Railway veya .env.local dosyasina ekle.',
    };
  }

  try {
    const res = await fetch(`${TELEGRAM_API}${token}/getMe`);
    const data = await res.json();
    if (!data.ok) {
      return {
        id: 'telegram',
        name: 'Telegram',
        kind: 'orchestration' as ConnectorKind,
        state: 'error',
        detail: `Token gecersiz: ${data.description || 'bilinmeyen hata'}`,
      };
    }
    return {
      id: 'telegram',
      name: 'Telegram',
      kind: 'orchestration' as ConnectorKind,
      state: 'connected',
      detail: `@${data.result.username} olarak bagli`,
      meta: {
        botId: data.result.id,
        username: data.result.username,
        firstName: data.result.first_name,
      },
    };
  } catch (err) {
    return {
      id: 'telegram',
      name: 'Telegram',
      kind: 'orchestration' as ConnectorKind,
      state: 'error',
      detail: `Baglanti hatasi: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** Mesaj gonder */
export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  env: Record<string, string | undefined> = process.env
): Promise<TelegramSendResult> {
  const token = getToken(env);
  if (!token) {
    return { ok: false, detail: 'TELEGRAM_BOT_TOKEN ayarlanmamis' };
  }

  try {
    const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      return { ok: false, detail: data.description || 'Mesaj gonderilemedi' };
    }
    return { ok: true, detail: 'Mesaj gonderildi', messageId: data.result.message_id };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

/** Son mesajlari al (getUpdates) */
export async function getRecentMessages(
  limit = 10,
  env: Record<string, string | undefined> = process.env
): Promise<TelegramMessage[]> {
  const token = getToken(env);
  if (!token) return [];

  try {
    const res = await fetch(`${TELEGRAM_API}${token}/getUpdates?limit=${limit}&allowed_updates=["message"]`);
    const data = await res.json();
    if (!data.ok || !data.result) return [];

    return data.result
      .filter((u: any) => u.message?.text)
      .map((u: any) => ({
        id: u.message.message_id,
        chatId: u.message.chat.id,
        chatTitle: u.message.chat.title || u.message.chat.first_name || 'DM',
        from: u.message.from?.first_name || 'Bilinmeyen',
        text: u.message.text,
        date: new Date(u.message.date * 1000),
      }));
  } catch {
    return [];
  }
}

/** Webhook ayarla (production icin) */
export async function setWebhook(
  url: string,
  env: Record<string, string | undefined> = process.env
): Promise<{ ok: boolean; detail: string }> {
  const token = getToken(env);
  if (!token) {
    return { ok: false, detail: 'TELEGRAM_BOT_TOKEN ayarlanmamis' };
  }

  try {
    const res = await fetch(`${TELEGRAM_API}${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, allowed_updates: ['message'] }),
    });
    const data = await res.json();
    return {
      ok: data.ok,
      detail: data.ok ? 'Webhook ayarlandi' : (data.description || 'Webhook ayarlanamadi'),
    };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}
