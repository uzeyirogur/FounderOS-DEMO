import type { FounderDb } from '@/lib/db';
import { PERSONAS } from '@/lib/personas-seed';
import type {
  Agent,
  AgentCron,
  AgentTask,
  Department,
  Domain,
  EmailListSnapshot,
  FunnelContact,
  FunnelTouch,
  Metric,
  Person,
  Phase,
  Project,
  RoadmapItem,
  LeadMagnet,
  SopTask,
  Workflow,
  Skill,
  SocialAccount,
  SocialDm,
  SocialDmSnapshot,
  SocialDmMessage,
  SocialPost,
  SocialSnapshot,
  Tool,
} from '@/lib/schemas';

// Monochrome palette — the UI is strict black & white; "color" fields carry
// grayscale steps used only for subtle hierarchy.
const GRAY = {
  white: '#fafafa',
  light: '#d4d4d4',
  mid: '#a3a3a3',
  dim: '#737373',
  dark: '#525252',
};

// Alex's operating pillars. Six original pillars (2026-06-12 directive) plus
// four added when the digital organization plan was approved: ANKA
// Operations (the ANKA+/TIVARO real estate), Product & Engineering (coding /
// QA / research), AI Intelligence (tooling scouting), and Idea Lab (scored
// idea generation). Growth & Marketing / Social Content & Publishing already
// live under Marketing/Growth; Communications and Clients were pre-existing.
const departments: Department[] = [
  { id: 'dept-sales', name: 'Sales', slug: 'sales', tagline: 'Pipeline and deals.', color: GRAY.white, order: 1 },
  { id: 'dept-marketing-growth', name: 'Marketing/Growth', slug: 'marketing-growth', tagline: 'Publishing, content, attention.', color: GRAY.light, order: 2 },
  { id: 'dept-content-studio', name: 'Content Studio', slug: 'content-studio', tagline: 'Real production: posts, media, growth, ads.', color: GRAY.dim, order: 3 },
  { id: 'dept-tech', name: 'TECH', slug: 'tech', tagline: 'AI & automations · G-Brain.', color: GRAY.mid, order: 4 },
  { id: 'dept-finance', name: 'Finances', slug: 'finances', tagline: 'Every processor, one view.', color: GRAY.dim, order: 5 },
  { id: 'dept-comms', name: 'Communications', slug: 'communications', tagline: 'Gmail, WhatsApp, Slack → one feed.', color: GRAY.dark, order: 6 },
  { id: 'dept-clients', name: 'Clients', slug: 'clients', tagline: 'Every client, onboarded and served.', color: GRAY.light, order: 7 },
  { id: 'dept-anka-ops', name: 'ANKA Operations', slug: 'anka-operations', tagline: 'ANKA+/TIVARO backend, read-only.', color: GRAY.mid, order: 8 },
  { id: 'dept-product-eng', name: 'Product & Engineering', slug: 'product-engineering', tagline: 'Coding, QA/UI review, competitor research.', color: GRAY.dark, order: 9 },
  { id: 'dept-ai-intelligence', name: 'AI Intelligence', slug: 'ai-intelligence', tagline: 'New AI tools, MCPs, skills, repos.', color: GRAY.light, order: 10 },
  { id: 'dept-idea-lab', name: 'Idea Lab', slug: 'idea-lab', tagline: 'New ideas, scored transparently.', color: GRAY.dim, order: 11 },
  { id: 'dept-usage-cost', name: 'Usage & Cost Monitor', slug: 'usage-cost', tagline: 'Claude/API usage and spend, tracked honestly.', color: GRAY.mid, order: 12 },
  { id: 'dept-exec-reporting', name: 'Executive Reporter', slug: 'executive-reporting', tagline: 'Every agent, one daily/weekly digest.', color: GRAY.white, order: 13 },
  { id: 'dept-personal', name: 'Personal', slug: 'personal', tagline: 'Work Assistant + Personal Ops — outside any project.', color: GRAY.mid, order: 14 },
];

// The roster IS the runtime — every row here maps 1:1 to a RuntimeAgent in
// lib/agents/real.ts (enforced by tests/seed.test.ts). No larp agents.
//
// Shape: top-level agents (parentId null) are INSTANCE slots — each one is
// what becomes its own Clawline / Claude Code process on a dedicated host
// (`instance` records that binding; everything is 'builtin' until then).
// Worker rows underneath them do one specific task each and sit at the
// bottom of the hierarchy.
const agents: Agent[] = [
  // ── TECH: AI head ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'conductor',
    departmentId: 'dept-tech',
    name: 'Conductor',
    role: 'Yayın ve Orkestrasyon',
    status: 'active',
    tier: 'lead',
    description: 'Mesajını tüm ajanlara aynı anda dağıtır ve gelecekteki bağlamalar için hangi instance host\'larının (Clawline, Ollama, tmux) kullanılabilir olduğunu kontrol eder.',
    model: 'fan-out runtime',
    tools: ['broadcast', 'clawline', 'tmux'],
    parentId: null,
    instance: 'builtin',
  },
  // ── Communications: one instance, three channel workers feeding /comms ────────
  {
    id: 'comms-agent',
    departmentId: 'dept-comms',
    name: 'Comms Agent',
    role: 'Birleşik İletişim Instance\'ı',
    status: 'active',
    tier: 'lead',
    description: 'Birleşik /comms akışını yönetir. Üç kanal işçisini bir araya toplar ve hangilerinin aktif olduğunu bildirir.',
    model: 'aggregate of workers',
    tools: ['comms-feed'],
    parentId: null,
    instance: 'builtin',
  },
  {
    id: 'gmail-worker',
    departmentId: 'dept-comms',
    name: 'Gmail Worker',
    role: 'IMAP Gelen Kutuları ×4',
    status: 'planned',
    tier: 'worker',
    description: 'En fazla dört IMAP gelen kutusundan okunmamış sayıları ve son e-postaları /comms\'a çeker. INBOX_* bilgileri tanımlandığında aktif olur.',
    model: 'imapflow',
    tools: ['imap'],
    parentId: 'comms-agent',
    instance: 'builtin',
  },
  {
    id: 'whatsapp-worker',
    departmentId: 'dept-comms',
    name: 'WhatsApp Worker',
    role: 'Sohbet İzleyici',
    status: 'active',
    tier: 'worker',
    description: 'Yerel WhatsApp ChatStorage\'ını (yerel ekip sohbetleri) /comms\'a okur. Şu anda çalışıyor.',
    model: 'local sqlite (read-only)',
    tools: ['whatsapp'],
    parentId: 'comms-agent',
    instance: 'builtin',
  },
  {
    id: 'slack-worker',
    departmentId: 'dept-comms',
    name: 'Slack Worker',
    role: 'Kanal Özeti',
    status: 'planned',
    tier: 'worker',
    description: 'Katılınan kanallardaki son mesajları /comms\'a aktarır. SLACK_BOT_TOKEN gerektirir.',
    model: '@slack/web-api',
    tools: ['slack'],
    parentId: 'comms-agent',
    instance: 'builtin',
  },
  // ── Marketing/Growth: social/content crew ───────────────────────────
  {
    id: 'social-agent',
    departmentId: 'dept-marketing-growth',
    name: 'Social Agent',
    role: 'Sosyal Medya ve İçerik Üretim Instance\'ı',
    status: 'active',
    tier: 'lead',
    description: 'Eski sosyal medya/içerik alanını yönetir. Gerçek üretim yüzeyi Content Studio\'dur (social-content-studio, growth-marketing, social-publishing, ad-creative-research) — bu instance artık yalnızca DM otomasyon hattını yürütür.',
    model: 'aggregate of workers',
    tools: ['dmflow'],
    parentId: null,
    instance: 'builtin',
  },
  {
    id: 'dmflow-mcp',
    departmentId: 'dept-marketing-growth',
    name: 'DMFlow MCP',
    role: 'DM Otomasyonu',
    status: 'planned',
    tier: 'worker',
    description: 'Sosyal medya DM otomasyonları, anahtar kelime akışları ve lead yakalama için DMFlow MCP/API hattı.',
    model: 'dmflow api',
    tools: ['dmflow'],
    parentId: 'social-agent',
    instance: 'builtin',
  },
  {
    id: 'sales-agent',
    departmentId: 'dept-sales',
    name: 'Sales Agent',
    role: 'Anlaşmalar ve Pipeline Instance\'ı',
    status: 'active',
    tier: 'lead',
    description: 'Eski satış alanını yönetir. İsimli hesap hatları (ürün lansmanı, kohort programı) ve Ledger CRM bağlantısı önceki bir operatörün demo verisiydi, 2026-08-28\'de kaldırıldı — bu instance artık gerçek bir CRM bağlantısı beklerken yalnızca arama verisi hattını yürütür.',
    model: 'aggregate of workers',
    tools: ['stripe', 'recall'],
    parentId: null,
    instance: 'builtin',
  },
  {
    id: 'stripe-sales',
    departmentId: 'dept-finance',
    name: 'Stripe',
    role: 'Satış Ödeme İşlemcisi',
    status: 'planned',
    tier: 'worker',
    description: 'Satış iş akışları ve hesap düzeyinde gelir kontrolleri için Stripe ödeme onay hattı.',
    model: 'stripe sdk',
    tools: ['stripe'],
    parentId: 'payments-pulse',
    instance: 'builtin',
  },
  {
    id: 'processor-confirmation',
    departmentId: 'dept-finance',
    name: 'Processor Confirm',
    role: 'Ödeme API Onayı',
    status: 'planned',
    tier: 'worker',
    description: 'Ödendi, başarısız, itiraz edildi ve bekliyor durumlarını onaylamak için ödeme işlemcilerine yapılan API çağrıları.',
    model: 'processor registry',
    tools: ['stripe', 'paypal', 'square', 'whop'],
    parentId: 'payments-pulse',
    instance: 'builtin',
  },
  {
    id: 'sales-calls-data',
    departmentId: 'dept-sales',
    name: 'Sales Calls Data',
    role: 'Görüşme İstihbaratı',
    status: 'planned',
    tier: 'worker',
    description: 'Kayıtlar, notlar, sonuçlar ve takip bağlamı için satış görüşmeleri veri hattı.',
    model: 'recall + crm',
    tools: ['recall'],
    parentId: 'sales-agent',
    instance: 'builtin',
  },
  // ── TECH: the G-Brain data analyst and its auditors ──────────────────────────────
  {
    id: 'data-agent',
    departmentId: 'dept-tech',
    name: 'Data Agent',
    role: 'G-Brain Analisti',
    status: 'active',
    tier: 'lead',
    description: 'G-Brain instance\'ına bağlıdır: markdown ve vektör depolama sağlığını analiz eder, fikirler ortaya çıkarır. Beyni sorgulayarak yayınlara yanıt verir.',
    model: 'gbrain CLI',
    tools: ['gbrain', 'brain-store', 'zeroentropy', 'supabase'],
    parentId: null,
    instance: 'builtin',
  },
  {
    id: 'markdown-auditor',
    departmentId: 'dept-tech',
    name: 'Markdown Auditor',
    role: 'brain-store Sağlığı',
    status: 'active',
    tier: 'worker',
    description: 'Markdown brain-store\'u tarar: klasör başına sayfa sayıları, kökteki başıboş dosyalar, boş klasörler. Şu anda çalışıyor.',
    model: 'fs walk',
    tools: ['brain-store'],
    parentId: 'data-agent',
    instance: 'builtin',
  },
  {
    id: 'vector-auditor',
    departmentId: 'dept-tech',
    name: 'Vector Auditor',
    role: 'pgvector / Supabase Sağlığı',
    status: 'active',
    tier: 'worker',
    description: 'gbrain doctor\'ı çalıştırır: Supabase pgvector bağlantısı, embedding kontrolleri, sağlık skoru. Şu anda çalışıyor.',
    model: 'gbrain doctor',
    tools: ['supabase', 'zeroentropy'],
    parentId: 'data-agent',
    instance: 'builtin',
  },
  {
    id: 'notion-sync',
    departmentId: 'dept-tech',
    name: 'Notion Sync',
    role: 'Çalışma Alanı Okuyucu',
    status: 'planned',
    tier: 'specialist',
    description: 'Entegrasyonla paylaşılan yakın zamanda düzenlenmiş sayfalar. NOTION_API_KEY gerektirir.',
    model: '@notionhq/client',
    tools: ['notion'],
    parentId: 'data-agent',
    instance: 'builtin',
  },
  // ── Finances ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'payments-pulse',
    departmentId: 'dept-finance',
    name: 'Payments Pulse',
    role: 'İşlemci İzleyici',
    status: 'planned',
    tier: 'lead',
    description: 'Stripe bakiyesi ve son işlemler; PayPal/Square/Whop kayıtlı ve anahtar bekliyor.',
    model: 'stripe sdk',
    tools: ['stripe', 'paypal', 'square', 'whop'],
    parentId: null,
    instance: 'builtin',
  },
  // ── TECH: automations ─────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'stack-monitor',
    departmentId: 'dept-tech',
    name: 'Stack Monitor',
    role: 'Yerel Altyapı Sağlığı',
    status: 'active',
    tier: 'lead',
    description: 'Reelkit, Ollama, command-center, Clawline, tmux, whisper, ffmpeg, renderly, gh ve Dictate Flow istatistikleri.',
    model: 'local checks',
    tools: ['reelkit', 'ollama', 'tmux', 'dictate'],
    parentId: null,
    instance: 'builtin',
  },
  // ── Clients: roster, onboarding, service ──────────────────────────────────
  {
    id: 'client-roster',
    departmentId: 'dept-clients',
    name: 'Client Roster',
    role: 'Güncel Müşteri Listesi',
    status: 'active',
    tier: 'lead',
    description: 'Kimin müşteri olduğuna dair tek gerçek kaynak: Ledger ve PayKit\'i funnel ile karşılaştırır ve listeyi güncel tutar.',
    model: 'funnel + Ledger',
    tools: ['ledger', 'paykit'],
    parentId: null,
    instance: 'builtin',
  },
  {
    id: 'client-onboarding',
    departmentId: 'dept-clients',
    name: 'Onboarding Agent',
    role: 'Anlaşma Kapanışından Başlangıca',
    status: 'planned',
    tier: 'worker',
    description: 'Bir anlaşma kapandığında onboarding sürecini baştan sona yürütür: karşılama paketi, çalışma alanı kurulumu, başlangıç toplantısı planlama, devir notları.',
    model: 'ledger + slack + notion',
    tools: ['ledger', 'slack', 'notion'],
    parentId: 'client-roster',
    instance: 'builtin',
  },
  {
    id: 'client-success',
    departmentId: 'dept-clients',
    name: 'Client Success',
    role: 'Hizmet ve Yenilemeler',
    status: 'planned',
    tier: 'worker',
    description: 'Aktif müşterilerin hizmetini sürdürür: kontrol sıklığı, görüşme notlarından teslimat takibi, yenileme ve ek satış uyarıları.',
    model: 'recall + slack',
    tools: ['recall', 'slack'],
    parentId: 'client-roster',
    instance: 'builtin',
  },
  // ── ANKA Operations: read-only view into the ANKA+/TIVARO backend ───────
  {
    id: 'anka-operations',
    departmentId: 'dept-anka-ops',
    name: 'ANKA Operations',
    role: 'ANKA+/TIVARO Salt Okuma Koordinatörü',
    status: 'planned',
    tier: 'lead',
    description:
      'ANKA+/TIVARO backend Admin API\'sini okur (bekleyen başvurular, grup/koç ataması, sporcu sayıları) — o reponun D-134 kararı gereği finansa asla dokunmaz. ' +
      'ANKA+ tarafında kendine ait salt okuma servis hesabı tanımlanana kadar planlı durumda.',
    model: 'anka-admin api (read-only)',
    tools: ['anka-admin'],
    parentId: null,
    instance: 'builtin',
  },
  // ── Product & Engineering: coding, QA, and competitor research ───────────
  {
    id: 'claude-code-orchestrator',
    departmentId: 'dept-product-eng',
    name: 'Claude Code Orchestrator',
    role: 'Kodlama Görevi Dağıtımı',
    status: 'active',
    tier: 'lead',
    description:
      'Project Registry\'den yetkili hedefleri okur ve kodlama işini projenin izin seviyesine göre dağıtır: ' +
      'read_only sadece rapor verir, auto_safe_write yerelde küçük düzeltmeleri commit edebilir, full_with_approval her zaman önce bir plan sunar. ' +
      'Asla push, merge veya deploy yapmaz.',
    model: 'claude code cli',
    tools: ['claude-code', 'project-registry'],
    parentId: null,
    instance: 'builtin',
  },
  {
    id: 'qa-ui-review',
    departmentId: 'dept-product-eng',
    name: 'QA & UI/UX Review',
    role: 'Test ve Tip Kontrol Özeti',
    status: 'active',
    tier: 'worker',
    description: 'Bu reponun kendi npm test (vitest JSON) ve npm run typecheck (tsc) çıktısını basit bir geçti/kaldı özetine dönüştürür.',
    model: 'vitest + tsc output parsing',
    tools: ['vitest', 'tsc'],
    parentId: 'claude-code-orchestrator',
    instance: 'builtin',
  },
  {
    id: 'product-competitor-research',
    departmentId: 'dept-product-eng',
    name: 'Product & Competitor Research',
    role: 'Web Araştırması',
    status: 'planned',
    tier: 'worker',
    description: 'Rakip hamlelerini ve ürün araştırmasını web üzerinde (Brave Search API) arar. BRAVE_SEARCH_API_KEY tanımlandığında aktif olur.',
    model: 'brave search api',
    tools: ['web-search'],
    parentId: 'claude-code-orchestrator',
    instance: 'builtin',
  },
  // ── AI Intelligence: new tools, MCPs, skills, repos ──────────────────────
  {
    id: 'ai-intelligence',
    departmentId: 'dept-ai-intelligence',
    name: 'AI Intelligence',
    role: 'Araç ve Repo Kaşifi',
    status: 'planned',
    tier: 'lead',
    description: 'GitHub\'ı benimsemeye değer yeni AI araçları, MCP sunucuları ve SKILL.md örüntüleri için izler. GITHUB_TOKEN tanımlandığında aktif olur.',
    model: 'github api',
    tools: ['github'],
    parentId: null,
    instance: 'builtin',
  },
  // ── Social Content Studio: real, tool-agnostic content production ───────
  {
    id: 'social-content-studio',
    departmentId: 'dept-content-studio',
    name: 'Social Content Studio',
    role: 'İçerik Üretimi (metin + keşfedilen medya araçları)',
    status: 'active',
    tier: 'lead',
    description:
      'Tüm içerik yüzeyini üretir — gönderiler, carousel\'ler, reklam kreatifleri, ürün tanıtım videoları, hareketli içerik, görseller, mockup\'lar, açılış sayfası kreatifleri, seslendirme, animasyon, 3D/web etkileşimli içerik — metni doğrudan LLM gateway ile yazarak, geri kalan her şey için Capability Registry üzerinden gerçek üretim araçları keşfederek. Üretmediği bir medyayı asla sahtesini yapmaz.',
    model: 'llm gateway + capability registry',
    tools: ['llm', 'capability-registry'],
    parentId: null,
    instance: 'builtin',
  },
  // ── Growth & Marketing: real project research ────────────────────────────
  {
    id: 'growth-marketing',
    departmentId: 'dept-content-studio',
    name: 'Growth & Marketing',
    role: 'Kitle, Konumlandırma, Kanal ve Huni Araştırması',
    status: 'active',
    tier: 'lead',
    description:
      'Gerçek bir Project Registry projesi için hedef kitle, konumlandırma, rakipler, kanallar, kullanıcı kazanımı, SEO, kampanyalar, huniler, açılış sayfaları ve dönüşümü canlı web araması ile araştırır — asla uydurma bir görüş sunmaz.',
    model: 'brave search api',
    tools: ['web-search'],
    parentId: null,
    instance: 'builtin',
  },
  // ── Ad / Creative Research: real competitor/format research ──────────────
  {
    id: 'ad-creative-research',
    departmentId: 'dept-content-studio',
    name: 'Ad / Creative Research',
    role: 'Rakip Kreatif ve Format Araştırması',
    status: 'active',
    tier: 'lead',
    description:
      'Rakip reklam kreatiflerini ve güncel formatları canlı web araması ile araştırır, ardından belirli bir platform/ürün tipine hangi formatın (gönderi, carousel, kısa video, statik reklam, açılış sayfası, tanıtım videosu) uyduğunu önerir — Social Content Studio\'nun doğrudan kullanabileceği bir kreatif brief üretir. Gerçek kaynak olmadan asla format önerisi uydurmaz.',
    model: 'brave search api',
    tools: ['web-search'],
    parentId: null,
    instance: 'builtin',
  },
  // ── Social Publishing: real publish planning, approval-gated ────────────
  {
    id: 'social-publishing',
    departmentId: 'dept-content-studio',
    name: 'Social Publishing',
    role: 'Yayın Planlama ve Kanal Uyarlaması',
    status: 'active',
    tier: 'lead',
    description:
      'Bir Content Studio içeriğinin hangi kanallara gideceğini planlar ve başlığı her platforma göre uyarlar. Operatörün açık onayı olmadan asla canlı yayınlamaz, gerçek bir kanal bağlantısı onaylamadan bir gönderinin yayınlandığını asla iddia etmez.',
    model: 'draft/approve/publish state machine',
    tools: ['publish-plans'],
    parentId: null,
    instance: 'builtin',
  },
  // ── Security Reviewer: real npm audit + secret scan against a registered project ──
  {
    id: 'security-reviewer',
    departmentId: 'dept-product-eng',
    name: 'Security Reviewer',
    role: 'Bağımlılık ve Gizli Bilgi Denetimi',
    status: 'active',
    tier: 'lead',
    description:
      'Yayından önce Project Registry ile yetkilendirilmiş bir dizinde gerçek npm audit ve regex tabanlı gizli bilgi taraması çalıştırır. Eşleşen gizli değeri asla raporlamaz, bir kontrol gerçekten çalışamadıysa asla "temiz" demez.',
    model: 'npm audit --json + regex secret scan (no LLM)',
    tools: ['npm-audit', 'fs-scan'],
    parentId: null,
    instance: 'builtin',
  },
  // ── UI/UX Reviewer: real static accessibility scan against a registered project ──
  {
    id: 'ui-ux-reviewer',
    departmentId: 'dept-product-eng',
    name: 'UI/UX Reviewer',
    role: 'Sunum Katmanı Kalitesi',
    status: 'active',
    tier: 'lead',
    description:
      'Project Registry ile yetkilendirilmiş bir dizinde gerçek bir statik erişilebilirlik taraması (eksik alt metin, aria-label\'ı olmayan ikon butonlar) çalıştırır. QA\'dan (test/build çıktısı) ve Security Reviewer\'dan (denetim/gizli bilgi) ayrıdır — bu sunum katmanı kalitesidir.',
    model: 'regex JSX accessibility scan (no LLM, no live browser)',
    tools: ['jsx-scan'],
    parentId: null,
    instance: 'builtin',
  },
  // ── Work Assistant: personal task list, separate from Project Registry ──
  {
    id: 'work-assistant',
    departmentId: 'dept-personal',
    name: 'Work Assistant',
    role: 'Kişisel Görev Takibi',
    status: 'active',
    tier: 'lead',
    description:
      'Kullanıcının kendi görev listesi — bilinçli olarak herhangi bir Project Registry projesine veya onun yaşam döngüsüne bağlı değil. Açık görevleri önceliğe ve son tarihe göre gerçek yaklaşan takvim (CalDAV) ile birlikte gösterir.',
    model: 'personal task repo + calendarStatus (no LLM)',
    tools: ['personal-tasks', 'calendar'],
    parentId: null,
    instance: 'builtin',
  },
  // ── Personal Ops: recurring routines/habits, separate from one-off tasks ──
  {
    id: 'personal-ops',
    departmentId: 'dept-personal',
    name: 'Personal Ops',
    role: 'Tekrarlayan Rutinler ve Alışkanlıklar',
    status: 'active',
    tier: 'lead',
    description:
      'Kullanıcının tekrarlayan rutinlerini/alışkanlıklarını takip eder (tek seferlik görev veya proje değil) — günlük/haftalık/aylık sıklıkla, yalnızca eklenen bir tamamlama kaydından hesaplanan dürüst bir seri (streak) ile.',
    model: 'routine repo + pure streak logic (no LLM)',
    tools: ['routines'],
    parentId: null,
    instance: 'builtin',
  },
  // ── Idea Lab: scored idea generation ──────────────────────────────────────
  {
    id: 'idea-lab-agent',
    departmentId: 'dept-idea-lab',
    name: 'Idea Lab',
    role: 'Fikir Kaydı ve Puanlama',
    status: 'active',
    tier: 'lead',
    description: 'Yeni uygulama/iş fikirlerini şeffaf bir ölçütle puanlar (pazar büyüklüğü, geliştirme kolaylığı, stratejik uyum) — düz bir ağırlıklı toplam, asla kapalı kutu bir AI görüşü değil.',
    model: 'deterministic rubric',
    tools: ['ideas-registry'],
    parentId: null,
    instance: 'builtin',
  },
  // ── Project Bootstrap: stack detection for registered projects ───────────
  {
    id: 'project-bootstrap',
    departmentId: 'dept-product-eng',
    name: 'Project Bootstrap',
    role: 'Teknoloji Tespiti ve Kontrol Listesi',
    status: 'active',
    tier: 'worker',
    description: 'Kayıtlı bir yerel projenin gerçek manifest dosyalarını (package.json, .csproj, requirements.txt, ...) okur ve bir teknoloji özeti ile başlangıç kontrol listesi önerir. Kendisi hiçbir şey kurmaz.',
    model: 'filesystem inspection',
    tools: ['project-registry'],
    parentId: 'claude-code-orchestrator',
    instance: 'builtin',
  },
  // ── Usage & Cost Monitor: Anthropic Admin API usage/cost ─────────────────
  {
    id: 'usage-cost-monitor',
    departmentId: 'dept-usage-cost',
    name: 'Usage & Cost Monitor',
    role: 'Model Kullanımı ve Maliyet Takibi',
    status: 'planned',
    tier: 'worker',
    description: 'Anthropic\'in Admin API kullanım/maliyet raporlarını okur. Anthropic Console\'dan ayrı bir Admin API anahtarı (sk-ant-admin...) gerektirir — ANTHROPIC_ADMIN_KEY tanımlandığında aktif olur.',
    model: 'anthropic admin api',
    tools: ['anthropic-usage'],
    parentId: 'stack-monitor',
    instance: 'builtin',
  },
  // ── Executive Reporter: turns agent_runs into a plain-language digest ────
  {
    id: 'executive-reporter',
    departmentId: 'dept-exec-reporting',
    name: 'Executive Reporter',
    role: 'Günlük/Haftalık Özet',
    status: 'active',
    tier: 'worker',
    description: 'Bir zaman aralığındaki her agent_run kaydını okur ve çalışma sayılarını, hataları ve ajan bazlı dökümü raporlar — LLM gerektirmez, çevrimdışı çalışır.',
    model: 'deterministic digest',
    tools: ['agent-runs'],
    parentId: 'conductor',
    instance: 'builtin',
  },
];

// ── Humans in the process ─────────────────────────────────────────────────────
// Real seats a prior operator's demo data invented specific fake names for
// (Marco, Nadia, Mia Torres, Dana Whitfield, Rae Winters) — removed as demo
// data. These roles are real (a person really does own sales calls, content
// approval, escalations, monthly books, and client relationships), so the
// role/department/tool/SOP-task structure stays; `name` honestly reads
// "role vacant" instead of a name nobody here actually goes by. Rename the
// `name` field when a real person is hired into the seat.
const people: Person[] = [
  { id: 'person-marco', departmentId: 'dept-sales', name: 'Head of Sales — role vacant', role: 'Head of Sales', tools: ['recall'] },
  { id: 'person-nadia', departmentId: 'dept-marketing-growth', name: 'Head of Growth & Marketing — role vacant', role: 'Head of Growth & Marketing', tools: ['dmflow'] },
  { id: 'person-mia', departmentId: 'dept-comms', name: 'Executive Assistant — role vacant', role: 'Executive Assistant', tools: ['imap', 'slack'] },
  { id: 'person-dana', departmentId: 'dept-finance', name: 'Bookkeeper — role vacant', role: 'Bookkeeper', tools: ['stripe'] },
  { id: 'person-rae', departmentId: 'dept-clients', name: 'Account Manager — role vacant', role: 'Account Manager', tools: ['recall'] },
];

// ── SOP tasks — every department role's job, written out ─────────────────────
// One task per worker, one worker per task (monogamous; tests enforce it).
// The chain the /brain graph draws: department → task → worker → tools.
// Lead magnetler — kullanıcı kendi içeriklerini ekleyene kadar BOŞ.
const leadMagnets: LeadMagnet[] = [];

// ── Project Registry — seeded starting point ─────────────────────────────────
// Real projects Alex actually works, registered so agents have somewhere
// legitimate to act. Both start read-only with no authorized agent: access
// is granted explicitly from /projects, never implied by being listed here.
const projects: Project[] = [
  {
    id: 'anka-tivaro',
    name: 'ANKA+ / TIVARO',
    kind: 'local',
    pathOrUrl: 'C:/Users/HP/source/repos/ANKA+',
    purpose:
      'Athlete development platform for ANKA Spor Atasehir (working brand TIVARO). ASP.NET Core backend, ' +
      'Vite admin web, Expo mobile.',
    status: 'active',
    permissionLevel: 'read_only',
    authorizedAgentIds: [],
    createdAt: '2026-08-27T00:00:00.000Z',
    updatedAt: '2026-08-27T00:00:00.000Z',
    origin: 'seed',
  },
  {
    id: 'is-ilan-radar',
    name: 'Is Ilan Radar',
    kind: 'git',
    pathOrUrl: 'https://github.com/example/is-ilan-radar.git',
    purpose: 'Job-listing radar product Alex is building to sell. Placeholder remote until the real repo is registered.',
    status: 'paused',
    permissionLevel: 'read_only',
    authorizedAgentIds: [],
    createdAt: '2026-08-27T00:00:00.000Z',
    updatedAt: '2026-08-27T00:00:00.000Z',
    origin: 'seed',
  },
];

const sopTasks: SopTask[] = [
  // TECH
  {
    id: 'sop-conductor', departmentId: 'dept-tech', assigneeKind: 'agent', assigneeId: 'conductor',
    title: 'Broadcast directives across the fleet',
    summary: 'One message in, every agent briefed, replies collected.',
    steps: [
      'Receive the directive from the operator console',
      'Resolve the target list: the whole fleet, or the pillar the directive names',
      'Poll instance hosts (Clawline, Ollama, tmux) for availability before dispatch',
      'Fan the message out to every target at once and stamp each send',
      'Collect replies as they land and file the run to agent_runs',
      'Report non-responders after sixty seconds so nothing fails silently',
    ],
  },
  {
    id: 'sop-data-agent', departmentId: 'dept-tech', assigneeKind: 'agent', assigneeId: 'data-agent',
    title: 'Answer questions from G-Brain',
    summary: 'Hybrid search over the second brain, honest fallbacks.',
    steps: [
      'Parse the incoming question into a gbrain query',
      'Run gbrain hybrid search (--no-expand) against Supabase',
      'Fall back to local brain-store grep when the database is paused',
      'Rank passages and keep only the ones that actually answer the question',
      'Return cited passages with their source notes, never invented ones',
      'Log unanswerable questions as gaps for the Markdown Auditor to fill',
    ],
  },
  {
    id: 'sop-markdown-auditor', departmentId: 'dept-tech', assigneeKind: 'agent', assigneeId: 'markdown-auditor',
    title: 'Audit brain-store markdown health',
    summary: 'Keep the knowledge base clean and linkable.',
    steps: [
      'Walk every markdown file in knowledge/brain-store',
      'Flag broken wiki-links, orphan notes and stale frontmatter',
      'Check generated org docs still match the live agents, SOPs and tools',
      'Write the health report with per-folder scores',
      'Queue fix-ups for the worst offenders and track them to done',
    ],
  },
  {
    id: 'sop-vector-auditor', departmentId: 'dept-tech', assigneeKind: 'agent', assigneeId: 'vector-auditor',
    title: 'Audit the vector index',
    summary: 'Embeddings in Supabase must mirror brain-store.',
    steps: [
      'Ping the Supabase Second Brain project (free tier pauses on idle)',
      'Wake the database and wait until it accepts queries before comparing',
      'Compare pgvector chunk counts against brain-store files',
      'Flag drift and paused-tier warnings on the /brain doctor card',
      'Trigger ZeroEntropy re-embeds for drifted documents and verify counts after',
    ],
  },
  {
    id: 'sop-notion-sync', departmentId: 'dept-tech', assigneeKind: 'agent', assigneeId: 'notion-sync',
    title: 'Mirror the Notion workspace',
    summary: 'Shared pages flow into the knowledge core.',
    steps: [
      'List pages shared with the integration token',
      'Diff each page against the last synced version',
      'Pull changed blocks and normalize to markdown',
      'Index the fresh content into the knowledge core',
      'Record the sync watermark so the next run only pulls deltas',
    ],
  },
  {
    id: 'sop-stack-monitor', departmentId: 'dept-tech', assigneeKind: 'agent', assigneeId: 'stack-monitor',
    title: 'Watch the local stack',
    summary: 'Honest status for every port, session and binary.',
    steps: [
      'Probe ports 4000 / 3789 / 11434 / 18789',
      'Check tmux sessions and required brew binaries',
      'Record honest ConnectorStatus, never fake connected',
      'Compare against the last sweep to catch flapping services',
      'Alert the console when something that was up goes down',
    ],
  },
  {
    id: 'sop-usage-cost-monitor', departmentId: 'dept-usage-cost', assigneeKind: 'agent', assigneeId: 'usage-cost-monitor',
    title: 'Track model usage and cost',
    summary: "Reads Anthropic's Admin API usage/cost report honestly.",
    steps: [
      'Check for an ANTHROPIC_ADMIN_KEY, a separate credential from a normal API key',
      'Call the organizations usage_report endpoint with a short timeout',
      'Report not_configured honestly when no admin key is present',
      'Never fabricate a cost or token count when the API is unreachable',
      'Surface the daily/weekly spend trend once the key is wired',
    ],
  },
  {
    id: 'sop-executive-reporter', departmentId: 'dept-exec-reporting', assigneeKind: 'agent', assigneeId: 'executive-reporter',
    title: 'Turn agent runs into a plain digest',
    summary: 'Deterministic daily/weekly summary, no LLM required.',
    steps: [
      'Read every agent_run inside the requested time window',
      'Group run counts and failures by agent id',
      'Sort recent failures newest first with their real summary text',
      'Compose one human-readable sentence with the real totals',
      'Never invent commentary the underlying runs do not support',
    ],
  },

  // ANKA OPERATIONS
  {
    id: 'sop-anka-operations', departmentId: 'dept-anka-ops', assigneeKind: 'agent', assigneeId: 'anka-operations',
    title: 'Read ANKA+/TIVARO operations, never finance',
    summary: 'Read-only Admin API view once a service account exists.',
    steps: [
      'Confirm ANKA_ADMIN_BASE_URL and ANKA_ADMIN_TOKEN are both set',
      'Call only read-only, non-financial routes on the ANKA+ backend',
      'Report pending applications, group/coach assignment, athlete counts',
      'Never surface price, subscription status, or payment data (D-134)',
      'Report not_configured honestly until the dedicated service account exists',
    ],
  },

  // PRODUCT & ENGINEERING
  {
    id: 'sop-security-reviewer', departmentId: 'dept-product-eng', assigneeKind: 'agent', assigneeId: 'security-reviewer',
    title: 'Audit a Project Registry-authorized directory before release',
    summary: 'Runs real npm audit and a regex secret scan against a project; treats an unreadable check as a fail, never as clean.',
    steps: [
      'Confirm the target project is registered and authorizes this agent',
      'Run npm audit --json in the project directory and parse the real output',
      'Walk the project source tree (skipping node_modules/.git/.next) and regex-scan for committed secrets',
      'Never include a matched secret value in the report — file, line, and pattern name only',
      'If npm audit could not run at all, report that honestly rather than reporting clean',
      'Flag high/critical vulnerabilities and any secret finding as blockers before deployment approval',
    ],
  },
  {
    id: 'sop-ui-ux-reviewer', departmentId: 'dept-product-eng', assigneeKind: 'agent', assigneeId: 'ui-ux-reviewer',
    title: 'Scan a Project Registry-authorized directory for accessibility defects',
    summary: 'Real static regex scan of .tsx source — missing alt text, icon-only buttons with no label. Separate from QA and Security Reviewer.',
    steps: [
      'Confirm the target project is registered and authorizes this agent',
      'Walk the project .tsx source (skipping node_modules/.git/.next)',
      'Flag every <img> with no alt attribute (empty alt="" is a valid decorative choice, not flagged)',
      'Flag every icon-only <button> with no aria-label and no visible text',
      'Report file and line for each finding — a real fix location, not a vague summary',
      'Never claim clean when nothing was actually scanned (e.g. the directory has no .tsx files)',
    ],
  },
  {
    id: 'sop-claude-code-orchestrator', departmentId: 'dept-product-eng', assigneeKind: 'agent', assigneeId: 'claude-code-orchestrator',
    title: 'Dispatch coding work at the authorized permission level',
    summary: 'Reads the Project Registry before touching any codebase.',
    steps: [
      'Read every active project from the Project Registry',
      'Filter to projects that explicitly authorize this agent',
      'For read_only projects, produce analysis only, never write',
      'For auto_safe_write projects, commit small safe fixes locally only',
      'For full_with_approval projects, always propose a plan and wait for yes',
      'Never push, merge, or deploy under any permission level',
    ],
  },
  {
    id: 'sop-qa-ui-review', departmentId: 'dept-product-eng', assigneeKind: 'agent', assigneeId: 'qa-ui-review',
    title: 'Digest real test and typecheck output',
    summary: 'Parses vitest JSON and tsc output, never re-implements them.',
    steps: [
      'Take the real npm test --reporter=json output as input',
      'Take the real npm run typecheck stderr as input',
      'Count passed/failed tests and TypeScript error lines',
      'List which files actually failed, by name',
      'Never report green when the underlying tool output says otherwise',
    ],
  },
  {
    id: 'sop-product-competitor-research', departmentId: 'dept-product-eng', assigneeKind: 'agent', assigneeId: 'product-competitor-research',
    title: 'Research competitors and market context',
    summary: 'Brave Search-backed web research, honestly gated on a key.',
    steps: [
      'Check for a BRAVE_SEARCH_API_KEY before attempting any search',
      'Report not_configured honestly when no key is present',
      'Run the requested query through the Brave Search API',
      'Return titles, URLs, and descriptions verbatim from the API',
      'Never invent a competitor fact the search did not actually return',
    ],
  },
  {
    id: 'sop-project-bootstrap', departmentId: 'dept-product-eng', assigneeKind: 'agent', assigneeId: 'project-bootstrap',
    title: 'Detect a new project stack from real files',
    summary: 'Reads manifest files on disk, never guesses from a name.',
    steps: [
      'List every local project in the Project Registry',
      'Read each project\'s real manifest files (package.json, .csproj, requirements.txt)',
      'Report detected languages, frameworks, and test runners',
      'Recommend a starter checklist based only on what was actually found',
      'Never run an install or write a file itself — recommend only',
    ],
  },

  // AI INTELLIGENCE
  {
    id: 'sop-ai-intelligence', departmentId: 'dept-ai-intelligence', assigneeKind: 'agent', assigneeId: 'ai-intelligence',
    title: 'Scout new AI tools, MCPs, and skills',
    summary: 'GitHub-backed scouting, honestly gated on a token.',
    steps: [
      'Check for a GITHUB_TOKEN before attempting any GitHub call',
      'Report not_configured honestly when no token is present',
      'Check the rate limit endpoint to confirm the token is valid',
      'Surface newly released tools, MCP servers, or SKILL.md patterns',
      'Never claim a repo exists or was updated without checking the API',
    ],
  },

  // IDEA LAB
  {
    id: 'sop-idea-lab-agent', departmentId: 'dept-idea-lab', assigneeKind: 'agent', assigneeId: 'idea-lab-agent',
    title: 'Score ideas on a transparent rubric',
    summary: 'Weighted sum of market size, ease-to-build, strategic fit.',
    steps: [
      'Read every idea registered in the ideas table',
      'Compute the score as a plain weighted sum of the three ratings',
      'Sort ideas by score, highest-leverage idea first',
      'Report the top idea and how many total ideas are tracked',
      'Never invent a rating the operator did not actually supply',
    ],
  },

  // COMMUNICATIONS
  {
    id: 'sop-comms-agent', departmentId: 'dept-comms', assigneeKind: 'agent', assigneeId: 'comms-agent',
    title: 'Compose the unified comms feed',
    summary: 'Three channels, one timeline at /comms.',
    steps: [
      'Collect fresh output from the Gmail, WhatsApp and Slack workers',
      'Dedupe and merge everything into one ordered timeline',
      'Tag each entry with its contact tier',
      'Bubble urgent and reply-needed items to the top of the feed',
      'Publish the feed and report which channels are live',
    ],
  },
  {
    id: 'sop-gmail-worker', departmentId: 'dept-comms', assigneeKind: 'agent', assigneeId: 'gmail-worker',
    title: 'Dört Gmail gelen kutusunu önceliklendir',
    summary: 'IMAP Gelen Kutuları 1-4 okunur, sınıflandırılır, yükseltilir.',
    steps: [
      'Yapılandırılmış dört IMAP gelen kutusunu senkronizasyon sıklığında bağla',
      'Okunmamış sayıları ve son taramadan sonraki her mesajı çek',
      'Her mesajı sınıflandır: acil, yanıt gerekiyor, bizden bekleniyor, bilgi amaçlı',
      'Yanıt gerektiren mesajlar için Alex\'in üslubunda önerilen yanıtlar hazırla',
      'Acil mesajları tek satırlık özetle yükseltme kuyruğuna aktar',
      'Bir müşteri alanından gelen her şeyi Müşteriler bölümüne de yansıt',
    ],
  },
  {
    id: 'sop-whatsapp-worker', departmentId: 'dept-comms', assigneeKind: 'agent', assigneeId: 'whatsapp-worker',
    title: 'Monitor WhatsApp chats',
    summary: 'Local team chats surfaced.',
    steps: [
      'Read the local ChatStorage.sqlite (read-only, nothing leaves the machine)',
      'Surface new messages from the LC and Vantage team chats',
      'Map senders to their contact tags',
      'Flag messages that mention money, deadlines or blockers',
      'Push tagged messages into the unified feed',
    ],
  },
  {
    id: 'sop-slack-worker', departmentId: 'dept-comms', assigneeKind: 'agent', assigneeId: 'slack-worker',
    title: 'Digest Slack channels',
    summary: 'Joined channels summarized into the feed.',
    steps: [
      'List channels the bot has joined',
      'Pull the latest messages per channel since the last sweep',
      'Summarize each channel into a short digest',
      'Call out direct mentions and unanswered questions separately',
      'Push the digest into the unified feed',
    ],
  },
  {
    id: 'sop-mia', departmentId: 'dept-comms', assigneeKind: 'person', assigneeId: 'person-mia',
    title: 'Handle escalations & VIP replies',
    summary: 'The human hands on the threads that need judgment.',
    steps: [
      'Review the escalation queue the workers built overnight',
      'Draft replies in Alex’s voice for VIP threads',
      'Send what is cleared, file the rest for Alex’s approval',
      'Chase any thread waiting on us for more than 24 hours',
      'Close the loop in /comms so nothing dangles',
    ],
  },

  // CONTENT STUDIO
  {
    id: 'sop-social-publishing', departmentId: 'dept-content-studio', assigneeKind: 'agent', assigneeId: 'social-publishing',
    title: 'Draft a publish plan, never post without approval',
    summary: 'Plans channels + per-platform caption adaptation for a Content Studio piece; a real post needs an explicit yes first.',
    steps: [
      'Read the produced content piece and the target platforms',
      'Adapt the caption per platform (length limits, tone) — flag anything truncated',
      'Save the plan at pending_approval — never skip straight to published',
      'Wait for an explicit approve/reject from the operator',
      'On approve, attempt the real publish via the channel connector; record the true result (published or failed with the real reason)',
      'Never report a post as published without a real connector confirming it',
    ],
  },
  {
    id: 'sop-growth-marketing', departmentId: 'dept-content-studio', assigneeKind: 'agent', assigneeId: 'growth-marketing',
    title: 'Research a growth focus area for a real project',
    summary: 'Target audience, positioning, competitor, channel, acquisition, SEO, campaign, funnel, landing page, or conversion — always tied to a Project Registry project.',
    steps: [
      'Read which project and which focus area (e.g. competitor, SEO, funnel) the brief is for',
      'Run a real web search for the query — never answer from memory alone',
      'Digest the real results into findings; keep every source URL for audit',
      'Save the brief to the Growth Briefs log, tied to the project',
      'If the search itself fails (e.g. no API key configured), report that honestly instead of a fabricated brief',
    ],
  },
  {
    id: 'sop-ad-creative-research', departmentId: 'dept-content-studio', assigneeKind: 'agent', assigneeId: 'ad-creative-research',
    title: 'Research competitor creatives and current formats for a real project',
    summary: 'Feeds a real creative brief (format + recommendation + sources) straight to Social Content Studio.',
    steps: [
      'Read which project, which target platform/product type, and which candidate format the brief is for',
      'Run a real web search for competitor creatives and current formats — never answer from memory alone',
      'Recommend a format only when real sources back it; keep every source URL for audit',
      'Save the brief to the Creative Briefs log, tied to the project',
      'If the search itself fails (e.g. no API key configured), report that honestly instead of a fabricated recommendation',
      'Hand the finished brief to Social Content Studio as its production input — never bypass the brief and guess',
    ],
  },
  {
    id: 'sop-social-content-studio', departmentId: 'dept-content-studio', assigneeKind: 'agent', assigneeId: 'social-content-studio',
    title: 'Produce a content piece, real tools only',
    summary: 'Text-native kinds go straight through the LLM; media kinds check the Capability Registry first.',
    steps: [
      'Read the brief and the requested content kind',
      'If the kind is text-native (social_post, carousel), write it directly via the LLM gateway',
      'Otherwise check the Capability Registry for an ACTIVE, approved provider for that capability',
      'If one exists, name it in the output — real invocation happens through that provider\'s own connector',
      'If none exists, run a live discovery search via AI Intelligence and record the candidates found',
      'Never fabricate media output — a piece without a real tool comes back needs_capability, not a fake link',
    ],
  },
  {
    id: 'sop-social-agent', departmentId: 'dept-marketing-growth', assigneeKind: 'agent', assigneeId: 'social-agent',
    title: 'Route DM automation and hand off to Content Studio',
    summary: 'Legacy pillar — real production now runs through Content Studio.',
    steps: [
      'Watch the DMFlow lane for triggered keyword flows',
      'Tag subscribers by intent as they move through a flow',
      'Hand production requests (posts, ads, video, visuals) to Content Studio, not this pillar',
      'Report DM-lane conversions to the growth dashboard',
      'Escalate any lead worth a human touch to Sales with full conversation context',
    ],
  },
  {
    id: 'sop-dmflow-mcp', departmentId: 'dept-marketing-growth', assigneeKind: 'agent', assigneeId: 'dmflow-mcp',
    title: 'Automate DM funnels',
    summary: 'Keyword triggers to booked conversations.',
    steps: [
      'Watch configured trigger keywords across platforms',
      'Fire the matching DMFlow flow for each trigger',
      'Tag subscribers by intent as they move through the flow',
      'Hand hot leads to the Sales pillar with their conversation history',
      'Report conversions back to the growth dashboard',
    ],
  },
  {
    id: 'sop-nadia', departmentId: 'dept-marketing-growth', assigneeKind: 'person', assigneeId: 'person-nadia',
    title: 'Set content strategy & approve drops',
    summary: 'The human editorial gate on everything published.',
    steps: [
      'Review last cycle’s performance numbers from the dashboard',
      'Set this week’s angles and slot them on the calendar',
      'Approve or kill every queued asset before it publishes',
      'Spot-check published posts landed exactly as approved',
      'Debrief the crew on what worked and what died',
    ],
  },

  // SALES
  {
    id: 'sop-sales-agent', departmentId: 'dept-sales', assigneeKind: 'agent', assigneeId: 'sales-agent',
    title: 'Keep the pipeline moving',
    summary: 'Legacy pillar — the named account lanes and CRM connection were prior-operator demo data, removed 2026-08-28.',
    steps: [
      'Pull every open deal and its stage from whatever CRM is actually connected',
      'Rank deals by value and days-in-stage; anything past 7 days is stalled',
      'Attach a concrete next action and owner to every stalled deal',
      'Prepare payment links across whatever processors are actually connected before calls',
      'Brief the sales lead with the top five deals and their objections before each call',
    ],
  },
  {
    id: 'sop-sales-calls-data', departmentId: 'dept-sales', assigneeKind: 'agent', assigneeId: 'sales-calls-data',
    title: 'Mine sales-call recordings',
    summary: 'Every Recall call becomes CRM intelligence.',
    steps: [
      'Ingest Recall notes after each recorded call',
      'Extract objections, commitments and next steps',
      'Write the extract back to whatever CRM is actually connected',
      'Tag calls where pricing or competitors came up',
      'Feed recurring patterns into the pipeline brief',
    ],
  },
  {
    id: 'sop-marco', departmentId: 'dept-sales', assigneeKind: 'person', assigneeId: 'person-marco',
    title: 'Run discovery & close calls',
    summary: 'The human on the phone from hello to signed.',
    steps: [
      'Review the pre-call brief and the lead’s last three touches',
      'Run the discovery script and qualify hard on budget and timeline',
      'Handle objections with the objection sheet, never improvise pricing',
      'Present the matching offer and the financing option when it fits',
      'Log the outcome, next step and payment link before the next call',
    ],
  },

  // FINANCES
  {
    id: 'sop-stripe', departmentId: 'dept-finance', assigneeKind: 'agent', assigneeId: 'stripe-sales',
    title: 'Track Stripe income',
    summary: 'Balance and charges, month over month.',
    steps: [
      'Pull balance and recent charges from Stripe',
      'Record the snapshot for the income chart',
      'Flag anomalies against the trailing average',
      'Note upcoming payouts so cash flow is never a surprise',
      'Reconcile the running total against the month-end books',
    ],
  },
  {
    id: 'sop-processor-confirm', departmentId: 'dept-finance', assigneeKind: 'agent', assigneeId: 'processor-confirmation',
    title: 'Confirm payments across processors',
    summary: 'No deal marked paid without an API receipt.',
    steps: [
      'Receive the payment claim from a sales lane',
      'Check the claimed processor’s API (Stripe / PayPal / Square / Whop)',
      'Confirm the charge or flag the mismatch loudly',
      'Write the confirmation onto the deal record',
      'Keep an audit trail of every confirmation for month-end close',
    ],
  },
  {
    id: 'sop-payments-pulse', departmentId: 'dept-finance', assigneeKind: 'agent', assigneeId: 'payments-pulse',
    title: 'Watch processor health',
    summary: 'Every processor pinged, status recorded honestly.',
    steps: [
      'Ping each processor registered in the registry',
      'Record honest ConnectorStatus, never fake connected',
      'Alert Finances when a processor goes down',
      'Re-check failed processors on a tighter cadence until they recover',
      'Keep the uptime history for the analytics view',
    ],
  },
  {
    id: 'sop-dana', departmentId: 'dept-finance', assigneeKind: 'person', assigneeId: 'person-dana',
    title: 'Close the books monthly',
    summary: 'The human sign-off on every month’s numbers.',
    steps: [
      'Import bank and processor statements for the month by the 3rd',
      'Categorize transactions using the statement’s own categories',
      'Reconcile against the income the agents recorded and chase every gap',
      'Confirm refunds and disputes are reflected in the venture totals',
      'Deliver the month-end P&L to Alex with three lines of commentary',
    ],
  },

  // CLIENTS
  {
    id: 'sop-client-roster', departmentId: 'dept-clients', assigneeKind: 'agent', assigneeId: 'client-roster',
    title: 'Keep the client roster live',
    summary: 'One list of every client, always current.',
    steps: [
      'Pull clients and deal states from Ledger and PayKit every morning',
      'Reconcile them against the funnel journeys and payment records',
      'Mark each account active, at risk, or churned with a reason',
      'Flag stale records and missing fields to the owning lane',
      'Publish the roster to the Clients pillar and note the deltas',
    ],
  },
  {
    id: 'sop-client-onboarding', departmentId: 'dept-clients', assigneeKind: 'agent', assigneeId: 'client-onboarding',
    title: 'Onboard new clients',
    summary: 'Closed-won to kickoff without a dropped step.',
    steps: [
      'Trigger when a deal moves to closed-won in Ledger',
      'Verify payment landed with Processor Confirm before anything ships',
      'Send the welcome pack and countersigned agreement within 24 hours',
      'Create their Slack channel, invite the client team, pin the scope doc',
      'Spin up the Notion workspace from the client template',
      'Book the kickoff call inside 5 business days and confirm attendance',
      'Collect access and assets (logins, brand kit, tracking) in one request',
      'Hand to Client Success with full context notes and the risk flags',
    ],
  },
  {
    id: 'sop-client-success', departmentId: 'dept-clients', assigneeKind: 'agent', assigneeId: 'client-success',
    title: 'Service active clients',
    summary: 'Cadence, deliverables and renewals on rails.',
    steps: [
      'Run the weekly check-in cadence per client, no skipped weeks',
      'Track deliverables against the sold scope and flag slippage early',
      'Log Recall call notes back to the client record the same day',
      'Score account health monthly: green, watch, or at risk with a reason',
      'Raise renewals and upsell openings 30 days out to Rae and Sales',
    ],
  },
  {
    id: 'sop-rae', departmentId: 'dept-clients', assigneeKind: 'person', assigneeId: 'person-rae',
    title: 'Own the client relationships',
    summary: 'The human accountable for every account.',
    steps: [
      'Run kickoff and quarterly business review calls',
      'Resolve escalations the same day they land',
      'Approve scope changes before work starts',
      'Review account health scores with Client Success monthly',
      'Sign off renewals and hand pricing changes to Sales',
    ],
  },

  // PERSONAL
  {
    id: 'sop-work-assistant', departmentId: 'dept-personal', assigneeKind: 'agent', assigneeId: 'work-assistant',
    title: "Keep Alex's own task list current",
    summary: 'Open tasks by priority and due date, alongside the real upcoming calendar. Never tied to a project.',
    steps: [
      'List open personal tasks sorted by priority then due date',
      'Surface the real upcoming calendar window (CalDAV) alongside them',
      'Add a task when asked, with an honest default priority (normal)',
      'Mark a task done only when explicitly told it is done',
      'Never create or imply a Project Registry entry for a personal task',
    ],
  },
  {
    id: 'sop-personal-ops', departmentId: 'dept-personal', assigneeKind: 'agent', assigneeId: 'personal-ops',
    title: "Track Alex's recurring routines honestly",
    summary: 'Daily/weekly/monthly habits with a real streak — never a one-off task, never a project.',
    steps: [
      'List active routines and each one\'s current streak from the completion log',
      'Log a check-in as append-only — never overwrite or backdate a prior entry',
      'Never log the same calendar day twice for one routine (idempotent check-in)',
      'Compute streak purely from the completion log — no separate counter to drift',
      'A missed day breaks the streak; do not soften or round the number',
    ],
  },
];

// Curated from a full-filesystem discovery sweep.
// status reflects what was VERIFIED on this machine: connected = creds/binary
// exist and worked; available = installed/configured but needs a key or start.
const tools: Tool[] = [
  // Knowledge
  { id: 'tool-gbrain', name: 'G-Brain (gbrain CLI)', category: 'Knowledge', status: 'connected', color: GRAY.white, description: 'v0.41 · brain-store markdown + Supabase + ZeroEntropy embedding\'leri. Aktif.' },
  { id: 'tool-brain-store', name: 'brain-store/', category: 'Knowledge', status: 'connected', color: GRAY.light, description: 'knowledge/brain-store altında yerel markdown bilgi tabanı.' },
  { id: 'tool-zeroentropy', name: 'ZeroEntropy', category: 'Knowledge', status: 'connected', color: GRAY.mid, description: 'gbrain hibrit aramasının arkasındaki vektör embedding\'leri. Anahtar ~/.config/knowledge/config.json içinde.' },
  { id: 'tool-supabase', name: 'Supabase (Second Brain)', category: 'Knowledge', status: 'available', color: GRAY.mid, description: '1240 sayfa / 15 bin parça. Ücretsiz plan boşta kalınca duraklıyor — sorgular başarısız olursa panelden yeniden başlat.' },
  { id: 'tool-obsidian', name: 'Notes Vault', category: 'Knowledge', status: 'connected', color: GRAY.light, description: 'Yerel not kasası. Doğrudan dosya sistemi erişimi.' },
  { id: 'tool-notion', name: 'Notion', category: 'Knowledge', status: 'available', color: GRAY.dim, description: 'İstemci hazır. NOTION_API_KEY tanımlayıp sayfaları entegrasyonla paylaş.' },
  // Social & growth
  { id: 'tool-postly', name: 'Postly', category: 'Social', status: 'available', color: GRAY.white, description: 'Sosyal medya yönetimi — hesap bağlandığında aktif olacak.' },
  { id: 'tool-dmflow', name: 'DMFlow', category: 'Social', status: 'available', color: GRAY.dim, description: 'DM otomasyonu. Uç nokta haritası shared-config içinde tam belgelenmiş; DMFLOW_API_KEY gerekiyor.' },
  { id: 'tool-skool', name: 'Skool (via Playwright)', category: 'Social', status: 'connected', color: GRAY.mid, description: 'Belgelenen Playwright akışıyla yürütülen topluluk yönetimi.' },
  // CRM & revenue
  { id: 'tool-ledger', name: 'Ledger', category: 'CRM & Revenue', status: 'connected', color: GRAY.white, description: 'Proje anlaşmaları. Anahtar MCP yapılandırmasından yeniden kullanılıyor (salt okuma: kayıt sorgulama, liste değil).' },
  { id: 'tool-paykit', name: 'PayKit', category: 'CRM & Revenue', status: 'planned', color: GRAY.light, description: 'Satış için teklif/ödeme/müşteri bağlamı, PayKit hattı dahil.' },
  { id: 'tool-flexpay', name: 'FlexPay', category: 'CRM & Revenue', status: 'planned', color: GRAY.mid, description: 'Satış teklifleri ve ödeme planı bağlamı için finansman seçenekleri.' },
  { id: 'tool-stripe', name: 'Stripe', category: 'CRM & Revenue', status: 'available', color: GRAY.light, description: 'İstemci tamamen hazır — STRIPE_SECRET_KEY tanımlanınca bakiye + tahsilatlar aktif olur.' },
  { id: 'tool-ghl', name: 'GoHighLevel', category: 'CRM & Revenue', status: 'planned', color: GRAY.dark, description: 'CLI sarmalayıcı knowledge/scripts içinde taslak; anahtarlar henüz eklenmedi.' },
  { id: 'tool-recall', name: 'Recall', category: 'CRM & Revenue', status: 'available', color: GRAY.mid, description: 'Günlük kullanılan AI toplantı not alıcısı. API erişimi için ayarlardan RECALL_API_KEY gerekiyor.' },
  { id: 'tool-webinarjam', name: 'WebinarJam', category: 'CRM & Revenue', status: 'available', color: GRAY.light, description: 'Webinar hunisi — kayıt olan ve katılan kişiler lead olarak sayılır. İstemci hazır; WEBINARJAM_API_KEY (hesap geneli) tanımla.' },
  { id: 'tool-trakyo', name: 'Trakyo', category: 'CRM & Revenue', status: 'planned', color: GRAY.dim, description: 'Gelir atıfı: içerik → planlanan görüşmeler → ödemeler. Trakyo genel API\'yi (TRAKYO_API_KEY) yayınlayana kadar sadece durum bilgisi.' },
  // Creative studio
  { id: 'tool-reelkit', name: 'Reelkit Pipeline', category: 'Creative', status: 'connected', color: GRAY.white, description: 'Yerel reelkit pipeline · temalar · 7 skill.' },
  { id: 'tool-renderly', name: 'Renderly CLI', category: 'Creative', status: 'connected', color: GRAY.light, description: 'v0.1.40, kimlik doğrulama keychain\'de. generate / product-photoshoot / marketing-studio / soul-id.' },
  { id: 'tool-adsmith', name: 'Adsmith', category: 'Creative', status: 'connected', color: GRAY.mid, description: 'UGC reklamları için kullanılıyor (Veo/Sora/Kling). Temel kimlik doğrulama env\'den.' },
  { id: 'tool-whisper', name: 'Whisper (local)', category: 'Creative', status: 'connected', color: GRAY.dim, description: 'whisper-cli + ffmpeg (brew ile). Yerel transkripsiyon, hiçbir veri makineden çıkmıyor.' },
  { id: 'tool-miro', name: 'Miro', category: 'Creative', status: 'connected', color: GRAY.mid, description: 'knowledge/.env.agents içindeki token ile REST API. GBrain mimari panosu mevcut.' },
  { id: 'tool-canva-figma', name: 'Canva + Figma', category: 'Creative', status: 'available', color: GRAY.dark, description: 'Claude MCP\'leri olarak bağlı (oturuma özel). Bağımsız API için ayrı anahtarlar gerekiyor.' },
  // Comms
  { id: 'tool-imap', name: 'Email (4 IMAP slots)', category: 'Comms', status: 'available', color: GRAY.light, description: '4 gelen kutusu için istemci hazır — INBOX_1..4_HOST/_USER/_PASS tanımla.' },
  { id: 'tool-slack', name: 'Slack', category: 'Comms', status: 'available', color: GRAY.mid, description: 'İstemci hazır. channels:read/history yetkilerine sahip bir bot token gerekiyor.' },
  { id: 'tool-dictate', name: 'Dictate Flow', category: 'Comms', status: 'connected', color: GRAY.white, description: 'Sesli dikte — bulunan en çok kullanılan günlük araç. Yerel flow.sqlite canlı okunuyor.' },
  { id: 'tool-whatsapp', name: 'WhatsApp', category: 'Comms', status: 'connected', color: GRAY.white, description: 'Masaüstü uygulamasının yerel ChatStorage.sqlite\'ı, salt okunur: yerel ekip sohbetleri.' },
  // Orchestration & infra
  { id: 'tool-command-center', name: 'Command Center (:4000)', category: 'Orchestration', status: 'available', color: GRAY.light, description: 'command-center: kanban, marka anlaşmaları, satış görüşmeleri, SOP\'lar, dispatch. npm run dev ile başlat.' },
  { id: 'tool-clawline', name: 'Clawline Gateway', category: 'Orchestration', status: 'available', color: GRAY.dim, description: 'Devre dışı — ağ geçidi çevrimdışı, token eksik. Onarım/yeniden kurulum gerekiyor.' },
  { id: 'tool-tmux', name: 'tmux', category: 'Orchestration', status: 'connected', color: GRAY.mid, description: 'Çoklu Claude oturum orkestrasyonu. Panel canlı oturum listesini okuyor.' },
  { id: 'tool-ollama', name: 'Ollama', category: 'Orchestration', status: 'connected', color: GRAY.light, description: 'Yerel LLM sunucusu :11434, kimlik doğrulama yok. Ücretsiz yerel çıkarım için bir model çek.' },
  { id: 'tool-vercel', name: 'Vercel CLI', category: 'Orchestration', status: 'connected', color: GRAY.mid, description: 'v50, kimlik doğrulaması yapıldı. FOUNDER OS yayına çıktığında dağıtım hedefi.' },
  { id: 'tool-gh', name: 'GitHub CLI', category: 'Orchestration', status: 'connected', color: GRAY.dim, description: 'gh 2.89, kimlik doğrulaması yapıldı.' },
  // Payments (registry awaiting keys)
  { id: 'tool-paypal', name: 'PayPal', category: 'Payments', status: 'planned', color: GRAY.mid, description: 'İşlemci kaydında listelendi; anahtarlar gelince istemci eklenecek.' },
  { id: 'tool-square', name: 'Square', category: 'Payments', status: 'planned', color: GRAY.dim, description: 'İşlemci kaydında listelendi; anahtarlar gelince istemci eklenecek.' },
  { id: 'tool-whop', name: 'Whop', category: 'Payments', status: 'planned', color: GRAY.dark, description: 'İşlemci kaydında listelendi; anahtarlar gelince istemci eklenecek.' },
];

const roadmap: RoadmapItem[] = [
  { id: 'rm-v1', title: 'FOUNDER OS v1 temel sürüm', quarter: '2026-Q2', status: 'done', departmentId: 'dept-tech', description: 'Altı görünüm, SQLite depoları, 32 test.' },
  { id: 'rm-mono', title: 'Monokrom yeniden yapım + gerçek bağlantılar', quarter: '2026-Q2', status: 'done', departmentId: 'dept-tech', description: 'Siyah-beyaz tema; IMAP, Slack, Stripe, Notion, gbrain bağlandı.' },
  { id: 'rm-gbrain', title: 'G-Brain sağlayıcısı aktif', quarter: '2026-Q2', status: 'done', departmentId: 'dept-tech', description: 'gbrain CLI doctor/query + brain-store yerel yedek.' },
  { id: 'rm-creds-email', title: '4 e-posta kutusunu bağla', quarter: '2026-Q2', status: 'now', departmentId: 'dept-comms', description: 'Uygulama şifreleri / IMAP bilgileri .env.local 1-4 alanlarına.' },
  { id: 'rm-creds-slack', title: 'Slack çalışma alanını bağla', quarter: '2026-Q2', status: 'now', departmentId: 'dept-comms', description: 'channels:read, channels:history izinli bot token.' },
  { id: 'rm-creds-payments', title: 'Ödeme sağlayıcılarını bağla', quarter: '2026-Q2', status: 'now', departmentId: 'dept-finance', description: 'Önce Stripe; anahtarlar geldikçe PayPal/Square/Whop.' },
  { id: 'rm-creds-notion', title: 'Notion çalışma alanını bağla', quarter: '2026-Q2', status: 'now', departmentId: 'dept-tech', description: 'Dahili entegrasyon gizli anahtarı + sayfa paylaşımları.' },
  { id: 'rm-supabase', title: 'Supabase Second Brain\'i yeniden başlat', quarter: '2026-Q2', status: 'now', departmentId: 'dept-tech', description: 'gbrain hibrit sorgularının tekrar çalışması için ücretsiz planı duraklatmadan çıkar.' },
  { id: 'rm-scheduler', title: 'Ajan zamanlayıcı (cron çalıştırmaları)', quarter: '2026-Q3', status: 'next', departmentId: 'dept-tech', description: 'Çalışma geçmişi ve hata uyarıları ile tekrarlayan ajan çalıştırmaları.' },
  { id: 'rm-llm', title: 'LLM özetleme katmanı', quarter: '2026-Q3', status: 'next', departmentId: 'dept-tech', description: 'Gelen kutusu/Slack/ödeme verisi üzerinde Claude API özetleri.' },
  { id: 'rm-host', title: 'Kendine ait sunucuya taşı', quarter: '2026-Q3', status: 'next', departmentId: 'dept-tech', description: 'Uygulama + gbrain + ajanları sunucuda barındır; Supabase yönetilen kalır.' },
  { id: 'rm-ui', title: 'Arayüz tasarım turu', quarter: '2026-Q4', status: 'later', departmentId: 'dept-tech', description: 'Tüm entegrasyonlar aktif olunca yönlendirilen yeniden tasarım.' },
  { id: 'rm-auth', title: 'Kimlik doğrulama + uzaktan erişim', quarter: '2026-Q4', status: 'later', departmentId: 'dept-tech', description: 'FOUNDER OS\'a sunucudan her yerden güvenle erişim.' },
];

// Honest zeros — these flip to live numbers as connectors come online.
const metrics: Metric[] = [
  { id: 'metric-unread', key: 'unread_total', label: 'Okunmamış (tüm kutular)', value: 0, unit: 'e-posta', delta: 0, period: 'kimlik bekliyor' },
  { id: 'metric-brain', key: 'brain_pages', label: 'Brain-store Sayfası', value: 0, unit: 'sayfa', delta: 0, period: 'Data Agent çalıştır' },
  { id: 'metric-balance', key: 'stripe_available', label: 'Stripe Bakiyesi', value: 0, unit: 'usd', delta: 0, period: 'kimlik bekliyor' },
  { id: 'metric-runs', key: 'agent_runs', label: 'Kayıtlı Ajan Çalıştırması', value: 0, unit: 'çalıştırma', delta: 0, period: 'tüm zamanlar' },
];

const domains: Domain[] = [
  { id: 'brm-1', number: 1, title: 'Komuta ve Hafıza', color: GRAY.white, items: ['G-Brain (gbrain CLI)', 'brain-store markdown', 'Ajan çalışma geçmişi', 'Operatör paneli'] },
  { id: 'brm-2', number: 2, title: 'E-posta Operasyonları', color: GRAY.light, items: ['Dört IMAP gelen kutusu', 'Okunmamış önceliklendirme', 'Kutu bazlı sağlık', 'Özet (planlanan)'] },
  { id: 'brm-3', number: 3, title: 'Ekip İletişimi', color: GRAY.light, items: ['Slack kanalları', 'Mesaj özetleri', 'Bahsedilme takibi (planlanan)'] },
  { id: 'brm-4', number: 4, title: 'Ödemeler ve Gelir', color: GRAY.mid, items: ['Stripe bakiye + tahsilatlar', 'PayPal / Square / Whop kaydı', 'Mutabakat (planlanan)'] },
  { id: 'brm-5', number: 5, title: 'Bilgi ve Dokümantasyon', color: GRAY.mid, items: ['Notion çalışma alanı', 'ZeroEntropy embedding\'leri', 'Supabase Second Brain'] },
  { id: 'brm-6', number: 6, title: 'Ajan Çalışma Zamanı', color: GRAY.dim, items: ['Kayıt + run()', 'Kalıcı çalışma günlüğü', 'Dürüst hata durumları'] },
  { id: 'brm-7', number: 7, title: 'Altyapı', color: GRAY.dim, items: ['Mevcut sunucu', 'kendine ait sunucu (sıradaki)', 'Yerel SQLite', 'Yönetilen Supabase'] },
  { id: 'brm-8', number: 8, title: 'Güvenlik', color: GRAY.dark, items: ['.env.local gizli bilgileri (gitignore\'da)', 'Salt okuma bağlantı kapsamları', 'Repoda anahtar yok'] },
];

const phases: Phase[] = [
  { id: 'phase-1', number: 1, title: 'Gerçek Bağlantılar', items: ['4 e-posta kutusu', 'Slack', 'Ödeme sağlayıcıları', 'Notion', 'G-Brain'] },
  { id: 'phase-2', number: 2, title: 'Gerçek Ajanlar', items: ['Çalışma zamanı + günlük', 'Dürüst durum panosu', 'İsteğe bağlı çalıştırmalar'] },
  { id: 'phase-3', number: 3, title: 'Otonomi', items: ['Zamanlanmış çalıştırmalar', 'LLM özetleri', 'Hata uyarıları'] },
  { id: 'phase-4', number: 4, title: 'Kendine Ait Sunucu', items: ['İşlemi taşı', 'Uzaktan erişim + kimlik doğrulama', '7/24 çalışma süresi'] },
];

// Sosyal hesaplar — kullanıcı kendi hesaplarını bağlayana kadar BOŞ.
// Gerçek veriler Postly/connector senkronizasyonuyla gelecek.
const socialAccounts: SocialAccount[] = [];

// Demo follower counts. LinkedIn has no baseline in this demo, so it gets
// honest nulls until scrapes land. Live syncs append from here.
// 91 days of DAILY snapshot dates ending on the final seeded capture, so
// the audience lines read densely at every 7/30/60/all-time window — which is
// also how the live daily Postly sync will fill them going forward.
const SERIES_END = '2026-06-12';
const SERIES_LEN = 91;
const SERIES_DATES: string[] = (() => {
  const end = new Date(`${SERIES_END}T00:00:00Z`);
  const out: string[] = [];
  for (let i = SERIES_LEN - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
})();

/**
 * Deterministic upward ramp from `start` to `end` across SERIES_DATES, with a
 * seeded organic wobble (two mixed frequencies + a slow drift) so daily history
 * reads like real growth rather than a straight line. The final point is forced
 * to `end` so the latest dummy value matches the seeded current value.
 */
function ramp(start: number, end: number, seed: number): number[] {
  const n = SERIES_DATES.length;
  const span = Math.abs(end - start);
  return SERIES_DATES.map((_, i) => {
    if (i === n - 1) return end;
    const t = i / (n - 1);
    // Smooth-ish accelerating trend (subtle S-curve) plus layered jitter.
    const trend = start + (end - start) * (0.7 * t + 0.3 * t * t);
    const wobble =
      (Math.sin(i * 0.7 + seed) * 0.6 + Math.sin(i * 0.27 + seed * 2) * 0.4) * span * 0.012;
    return Math.max(0, Math.round(trend + wobble));
  });
}

// Takipçi sayıları — hesap bağlanana kadar BOŞ.
const FOLLOWER_TARGETS: { platform: SocialAccount['platform']; start: number; end: number }[] = [];
const socialBaseline: SocialSnapshot[] = [];

// E-posta listesi — Beehiiv bağlanana kadar BOŞ.
const emailListBaseline: EmailListSnapshot[] = [];

// DM sayıları — connector bağlanana kadar BOŞ.
const DM_TARGETS: { platform: SocialDm['platform']; start: number; end: number }[] = [];
const socialDms: SocialDm[] = [];
const socialDmMessages: SocialDmMessage[] = [];
const socialDmSnapshots: SocialDmSnapshot[] = [];

// Sıraya alınmış paylaşım — boş başlar.
const socialPosts: SocialPost[] = [];

// ── Funnel journeys — DUMMY clients from first touch to conversion ──────────
// Real-ready: `source` on every touch names where it will come from live —
// 'trakyo' (organic attribution), 'meta-ads' (Meta Ads MCP), 'manual' until
// then. Swapping seed for live pulls is a repo-level change; the shape stays.
// Touch dates are DAYS-AGO offsets resolved at seed time, so the space's
// stall coloring (quiet > 7 days pre-conversion → red) stays truthful no
// matter when the DB is re-seeded.
const funnelDay = (daysBack: number): string =>
  new Date(Date.now() - daysBack * 86_400_000).toISOString().slice(0, 10);

type SeededTouch = [FunnelTouch['stage'], FunnelTouch['channel'], string, FunnelTouch['source'], number];
type SeededJourney = {
  id: string;
  name: string;
  venture: FunnelContact['venture'];
  relationship: FunnelContact['relationship'];
  likelihood: number; // 0–100 likelihood-to-buy (dummy; later CRM/Trakyo-scored)
  product?: string;
  amountUsd?: number;
  email?: string; // dummy contact channels so the demo shows outreach actions
  phone?: string;
  person?: string; // the human behind the deal — demo dossier identity
  company?: string;
  role?: string;
  linkedin?: string;
  touches: SeededTouch[]; // 4–5, chronological (last number = days ago)
};

// Satış hunisi — müşteri verisi bağlanana kadar BOŞ.
// Gerçek veriler CRM/Trakyo entegrasyonuyla gelecek.
const FUNNEL_JOURNEYS: SeededJourney[] = [];
const funnelContacts: FunnelContact[] = [];
const funnelTouches: FunnelTouch[] = [];

// İş akışları — kullanıcı kendi süreçlerini tanımlayana kadar BOŞ.
const workflows: Workflow[] = [];

// Görev panosu — boş başlar, gerçek görevler kullanımda eklenir.
const agentTasks: AgentTask[] = [];

const SKILL_STATUS_NOTE: Record<string, string> = {
  live: 'Üretimde aktif. Sahibi ajan bunu bugün çalıştırıyor.',
  learning: 'Eğitimde. Kalibre olurken bir insan gözetiminde çalışır.',
  planned: 'Planlandı. Kapsamı belirlendi ve sıraya alındı, henüz bağlanmadı.',
};

/** Compose a real-ready SKILL.md doc from a skill's fields (viewed from its card). */
function skillDoc(s: Omit<Skill, 'markdown'>): string {
  const slug = s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const toolLine = s.tools.length ? s.tools.map((t) => `\`${t}\``).join(', ') : 'harici araç yok';
  return `---
name: ${slug}
description: ${s.description}
category: ${s.category}
status: ${s.status}
---

# ${s.name}

${s.description}

## Ne zaman kullanılır
${s.category.toLowerCase()} akışının ${s.name.toLowerCase()} yapması gerektiğinde buna başvur. ${toolLine} üzerinde çalışır.

## Durum
${SKILL_STATUS_NOTE[s.status] ?? s.status}
`;
}

// The capability library the agent workforce draws on.
const skills: Omit<Skill, 'markdown'>[] = [
  { id: 'skill-outbound', name: 'Soğuk müşteri erişimi', category: 'Satış', description: 'Ölçekte sohbet başlatan çok temaslı DM + içerik sıklığı.', ownerAgentId: 'postly-publisher', status: 'live', tools: ['postly', 'dmflow'], order: 0 },
  { id: 'skill-qualify', name: 'Yanıt değerlendirme', category: 'Satış', description: 'Gelen yanıtları okur, niyeti puanlar ve uygun olanları görüşmeye ayırtır.', ownerAgentId: 'comms-agent', status: 'live', tools: ['dmflow', 'gmail'], order: 1 },
  { id: 'skill-proposal', name: 'Teklif taslağı hazırlama', category: 'Satış', description: 'Bir görüşme dökümünü markaya uygun, özel bir teklife dönüştürür.', ownerAgentId: null, status: 'learning', tools: ['proposal-gen', 'ledger'], order: 2 },
  { id: 'skill-hooks', name: 'Hook yazımı', category: 'İçerik', description: 'Her platforma göre ayarlanmış kısa formatlı hook ve başlıklar.', ownerAgentId: 'social-agent', status: 'live', tools: ['postly'], order: 3 },
  { id: 'skill-ugc', name: 'UGC üretimi', category: 'İçerik', description: 'Reklama hazır UGC varyasyonları üretir (Veo / Sora / Kling).', ownerAgentId: 'adsmith-creative', status: 'live', tools: ['adsmith'], order: 4 },
  { id: 'skill-edit', name: 'Video kurgusu', category: 'İçerik', description: 'Reels ve öne çıkanlar klipslerini programatik olarak kurgular.', ownerAgentId: 'reelkit-editor', status: 'live', tools: ['reelkit'], order: 5 },
  { id: 'skill-schedule', name: 'Çoklu platform zamanlama', category: 'İçerik', description: 'Bağlı her platforma sıraya alıp yayınlar.', ownerAgentId: 'postly-publisher', status: 'live', tools: ['postly'], order: 6 },
  { id: 'skill-triage', name: 'Gelen kutusu önceliklendirme', category: 'Operasyon', description: 'Dört gelen kutusunu iş / kişisel / diğer olarak ayırır ve öncelik işaretler.', ownerAgentId: 'gmail-worker', status: 'live', tools: ['gmail'], order: 7 },
  { id: 'skill-dm', name: 'DM yönetimi', category: 'Operasyon', description: 'Instagram ve WhatsApp DM\'lerini baştan sona yönetir.', ownerAgentId: 'comms-agent', status: 'live', tools: ['dmflow', 'whatsapp'], order: 8 },
  { id: 'skill-retrieval', name: 'Bilgi erişimi', category: 'Operasyon', description: 'Her ajanın aynı hafızayı paylaşması için G-Brain üzerinde hibrit arama.', ownerAgentId: 'conductor', status: 'live', tools: ['gbrain'], order: 9 },
  { id: 'skill-reconcile', name: 'Ödeme mutabakatı', category: 'Operasyon', description: 'İşlemci ödemelerini Stripe ve PayKit üzerinden müşterilerle eşleştirir.', ownerAgentId: null, status: 'planned', tools: ['stripe', 'paykit'], order: 10 },
  { id: 'skill-attribution', name: 'Gelir atfı', category: 'Operasyon', description: 'İçerik ve görüşmeleri Trakyo üzerinden kapanan gelirle ilişkilendirir.', ownerAgentId: null, status: 'planned', tools: ['trakyo', 'ghl'], order: 11 },
];

// ── Scheduler / Autonomy ──────────────────────────────────────────────────
// A sane, spaced-out cron distribution — each targets a real runtime agent
// (see lib/agents/real.ts). Deliberately conservative frequencies so no
// agent gets hammered: cron syntax is UTC, 'minute hour day month weekday'.
const agentCrons: AgentCron[] = [
  {
    id: 'cron-conductor-health',
    agentId: 'conductor',
    schedule: '*/30 * * * *',
    description: '30 dakikada bir sistem sağlığı / sistemler arası engel kontrolü.',
    enabled: true,
    createdAt: '2026-08-28T00:00:00.000Z',
    lastRunAt: null,
  },
  {
    id: 'cron-executive-daily-report',
    agentId: 'executive-reporter',
    schedule: '0 7 * * *',
    description: 'Her gün 07:00 UTC\'de günlük özet — gece boyunca neler oldu.',
    enabled: true,
    createdAt: '2026-08-28T00:00:00.000Z',
    lastRunAt: null,
  },
  {
    id: 'cron-ai-intelligence-scout',
    agentId: 'ai-intelligence',
    schedule: '0 3 * * *',
    description: 'Her gece 03:00 UTC\'de araç/yetenek keşif taraması.',
    enabled: true,
    createdAt: '2026-08-28T00:00:00.000Z',
    lastRunAt: null,
  },
  {
    id: 'cron-conductor-lifecycle-review',
    agentId: 'conductor',
    schedule: '0 */4 * * *',
    description: '4 saatte bir proje yaşam döngüsü incelemesi — bekleyen onaylar ve tıkanmış fazlar.',
    enabled: true,
    createdAt: '2026-08-28T00:00:00.000Z',
    lastRunAt: null,
  },
  {
    id: 'cron-anka-operations-check',
    agentId: 'anka-operations',
    schedule: '0 */6 * * *',
    description: '6 saatte bir ANKA+/TIVARO backend bağlantı kontrolü (salt okuma).',
    enabled: true,
    createdAt: '2026-08-28T00:00:00.000Z',
    lastRunAt: null,
  },
  {
    id: 'cron-capability-verification',
    agentId: 'ai-intelligence',
    schedule: '0 5 * * *',
    description: 'Her gün 05:00 UTC\'de günlük yetenek kaydı doğrulaması — kurulum/yapılandırma durumunu yeniden kontrol eder.',
    enabled: true,
    createdAt: '2026-08-28T00:00:00.000Z',
    lastRunAt: null,
  },
];

export function seedDatabase(db: FounderDb): void {
  // INSERT OR REPLACE in every repo makes re-seeding idempotent by id.
  for (const d of departments) db.departments.insert(d);
  for (const a of agents) db.agents.insert(a);
  // The roster IS the runtime: rows that left the roster leave the DB too,
  // and departments that left the operating model go with them.
  db.agents.deleteWhereIdNotIn(agents.map((a) => a.id));
  db.departments.deleteWhereIdNotIn(departments.map((d) => d.id));
  for (const p of people) db.people.insert(p);
  db.people.deleteWhereIdNotIn(people.map((p) => p.id));
  for (const m of leadMagnets) db.leadMagnets.insert(m);
  db.leadMagnets.deleteWhereIdNotIn(leadMagnets.map((m) => m.id));
  for (const pr of projects) db.projects.insert(pr);
  db.projects.deleteWhereIdNotIn(projects.map((pr) => pr.id));
  for (const t of sopTasks) db.sopTasks.insert(t);
  db.sopTasks.deleteWhereIdNotIn(sopTasks.map((t) => t.id));
  for (const w of workflows) db.workflows.insert(w);
  db.workflows.deleteWhereIdNotIn(workflows.map((w) => w.id));
  for (const s of skills) db.skills.insert({ ...s, markdown: skillDoc(s) });
  db.skills.deleteWhereIdNotIn(skills.map((s) => s.id));
  for (const t of agentTasks) db.agentTasks.insert(t); // insert-by-id; user tasks coexist
  for (const t of tools) db.tools.insert(t);
  for (const r of roadmap) db.roadmap.insert(r);
  for (const m of metrics) db.metrics.insert(m);
  for (const d of domains) db.domains.insert(d);
  for (const p of PERSONAS) db.personas.insert(p);
  for (const p of phases) db.phases.insert(p);
  for (const a of socialAccounts) db.social.upsertAccount(a);
  for (const s of socialBaseline) db.social.insertSnapshot(s);
  for (const d of socialDms) db.social.upsertDm(d);
  for (const s of socialDmSnapshots) db.social.insertDmSnapshot(s);
  for (const m of socialDmMessages) db.social.upsertDmMessage(m);
  // Retired dummy email history leaves the DB on re-seed; the real Beehiiv
  // baseline is authoritative. Live-synced snapshots survive.
  db.emailList.deleteSeeded();
  for (const s of emailListBaseline) db.emailList.insertSnapshot(s);
  for (const p of socialPosts) db.socialPosts.enqueue(p);
  for (const c of funnelContacts) db.funnel.insertContact(c);
  for (const t of funnelTouches) db.funnel.insertTouch(t);
  for (const c of agentCrons) db.agentCrons.insert(c);
}
