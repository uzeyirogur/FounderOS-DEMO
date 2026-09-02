import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/lib/connectors/telegram';
import { braveSearch } from '@/lib/connectors/web-search';

type TelegramUpdate = {
  message?: {
    message_id: number;
    chat: { id: number; title?: string; first_name?: string };
    from?: { id: number; first_name?: string; username?: string };
    text?: string;
    date: number;
  };
};

// Arastirma anahtar kelimeleri
const RESEARCH_KEYWORDS = ['araştır', 'arastir', 'bul', 'karşılaştır', 'karsilastir', 'incele', 'analiz'];

function isResearchRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return RESEARCH_KEYWORDS.some(k => lower.includes(k));
}

// Web arastirmasi yap ve formatla
async function doResearch(query: string): Promise<string> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) {
    return 'Arastirma sistemi yapilandirmamis (BRAVE_SEARCH_API_KEY eksik).';
  }

  try {
    const results = await braveSearch(query, key, 8);
    if (results.length === 0) {
      return `"${query}" icin sonuc bulunamadi.`;
    }

    let response = `🔍 <b>Arastirma: ${query}</b>\n\n`;
    
    results.forEach((r, i) => {
      response += `<b>${i + 1}. ${r.title}</b>\n`;
      response += `${r.description.slice(0, 200)}${r.description.length > 200 ? '...' : ''}\n`;
      response += `🔗 ${r.url}\n\n`;
    });

    response += `\n📊 ${results.length} sonuc bulundu. Detayli analiz icin "analiz et" yaz.`;
    return response;
  } catch (err) {
    return `Arastirma hatasi: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// Komut isleyicileri
async function handleCommand(chatId: number, text: string, from: string): Promise<string> {
  const cmd = text.toLowerCase().trim();

  // /start komutu
  if (cmd === '/start') {
    return `Merhaba ${from}! UZO Komuta Merkezi aktif.

Kullanilabilir komutlar:
/durum - Sistem durumu
/projeler - Aktif projeler
/arastir [konu] - Web arastirmasi
/yardim - Komut listesi

Veya direkt talimat yaz:
"video uretim araclarini arastir"
"Kling vs Runway karsilastir"`;
  }

  // /yardim komutu
  if (cmd === '/yardim' || cmd === '/help') {
    return `UZO Komuta Merkezi - Komutlar:

/durum - FounderOS sistem durumu
/projeler - Aktif proje listesi
/arastir [konu] - Web arastirmasi baslat
/rapor - Gunluk ozet

Ornek talimatlar:
"AI video araclarini arastir"
"Kling AI fiyatlarini bul"
"sosyal medya zamanlama araclari karsilastir"`;
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
- Telegram: Bagli
- Arastirma: ${process.env.BRAVE_SEARCH_API_KEY ? 'Aktif' : 'Devre disi'}`;
    } catch {
      return 'Sistem durumu alinamadi. Sunucu calisiyor mu?';
    }
  }

  // /arastir komutu
  if (cmd.startsWith('/arastir') || cmd.startsWith('/araştır')) {
    const query = text.replace(/^\/(arastir|araştır)\s*/i, '').trim();
    if (!query) {
      return 'Kullanim: /arastir [konu]\nOrnek: /arastir AI video uretim araclari';
    }
    await sendTelegramMessage(chatId, `🔄 "${query}" arastiriliyor...`);
    return await doResearch(query);
  }

  // Diger komutlar henuz tanimli degil
  if (cmd.startsWith('/')) {
    return `Komut henuz aktif degil: ${cmd}
/yardim yazarak mevcut komutlari gorebilirsin.`;
  }

  // Normal mesaj - arastirma mi kontrol et
  if (isResearchRequest(text)) {
    await sendTelegramMessage(chatId, `🔄 Arastiriliyor...`);
    return await doResearch(text);
  }

  // Diger talimatlar
  return `Talimat alindi: "${text}"

Simdilik sadece arastirma komutlari aktif.
Ornek: "video uretim araclarini arastir"

Diger ozellikler yakin zamanda eklenecek.`;
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
