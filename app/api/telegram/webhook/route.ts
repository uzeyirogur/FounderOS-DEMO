import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/lib/connectors/telegram';

// Telegram'dan gelen komutlari isleyen ana handler
// Simdilik basit echo + komut tanimlari

type TelegramUpdate = {
  message?: {
    message_id: number;
    chat: { id: number; title?: string; first_name?: string };
    from?: { id: number; first_name?: string; username?: string };
    text?: string;
    date: number;
  };
};

// Komut isleyicileri
async function handleCommand(chatId: number, text: string, from: string): Promise<string> {
  const cmd = text.toLowerCase().trim();

  // /start komutu
  if (cmd === '/start') {
    return `Merhaba ${from}! UZO Komuta Merkezi aktif.

Kullanilabilir komutlar:
/durum - Sistem durumu
/projeler - Aktif projeler
/ajans - Ajan listesi
/yardim - Komut listesi

Veya direkt talimat yaz, ben anlayacagim.`;
  }

  // /yardim komutu
  if (cmd === '/yardim' || cmd === '/help') {
    return `UZO Komuta Merkezi - Komutlar:

/durum - FounderOS sistem durumu
/projeler - Aktif proje listesi
/ajans - Calisan ajan listesi
/arastir [konu] - Arastirma baslat
/rapor - Gunluk ozet

Veya direkt yazabilirsin:
"Is Radar icin video araci arastir"
"Yarin icin 3 post hazirla"`;
  }

  // /durum komutu
  if (cmd === '/durum' || cmd === '/status') {
    const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4100';
    
    try {
      const res = await fetch(`${baseUrl}/api/health`, { next: { revalidate: 0 } });
      const health = await res.json();
      return `FounderOS Durumu:
- Ajanlar: ${health.agentCount || '?'} aktif
- Uptime: ${Math.floor((health.uptimeSeconds || 0) / 60)} dakika
- Veritabani: ${health.db === 'ok' ? 'Bagli' : 'Hata'}
- Telegram: Bagli`;
    } catch {
      return 'Sistem durumu alinamadi. Sunucu calisiyor mu?';
    }
  }

  // Diger komutlar henuz tanimli degil
  if (cmd.startsWith('/')) {
    return `Komut henuz aktif degil: ${cmd}
/yardim yazarak mevcut komutlari gorebilirsin.`;
  }

  // Normal mesaj - AI isleme icin kuyrukla (simdilik echo)
  return `Talimat alindi: "${text}"

Bu ozellik yakin zamanda aktif olacak. Talimatlariniz AI ajana iletilecek ve sonuc size bildirilecek.`;
}

export async function POST(req: NextRequest) {
  try {
    const update: TelegramUpdate = await req.json();

    // Mesaj yoksa atla
    if (!update.message?.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = update.message.chat.id;
    const text = update.message.text;
    const from = update.message.from?.first_name || 'Kullanici';

    // Komutu isle
    const response = await handleCommand(chatId, text, from);

    // Cevabi gonder
    await sendTelegramMessage(chatId, response);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Telegram webhook error:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// Telegram webhook dogrulamasi icin GET
export async function GET() {
  return NextResponse.json({ status: 'Telegram webhook aktif' });
}
