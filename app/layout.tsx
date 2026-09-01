import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { CommandPalette } from '@/components/CommandPalette';
import { ConductorPanel } from '@/components/ConductorPanel';
import { getDb } from '@/lib/data';
import type { Command } from '@/lib/palette';
import { THEME_INIT_SCRIPT } from '@/lib/theme';

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'FOUNDER OS',
  description: 'Tek kişilik bir şirket için kişisel işletim sistemi ve yapay zeka ajan komuta merkezi',
};

const NAV_COMMANDS: Command[] = [
  { id: 'nav-home', label: 'Ana Sayfa', keywords: 'dashboard today overview start home', href: '/', hint: 'görünüm' },
  { id: 'nav-social', label: 'Sosyal', keywords: 'instagram tiktok twitter x youtube linkedin followers growth zernio founderos social', href: '/social', hint: 'görünüm' },
  { id: 'nav-comms', label: 'İletişim', keywords: 'messages email whatsapp slack inbox unified feed comms', href: '/comms', hint: 'görünüm' },
  { id: 'nav-agents', label: 'Ajanlar', keywords: 'runtime run real roster agents', href: '/agents', hint: 'görünüm' },
  { id: 'nav-connections', label: 'Bağlantılar', keywords: 'integrations tools status creds connections', href: '/integrations', hint: 'görünüm' },
  { id: 'nav-roadmap', label: 'Yol Haritası', keywords: 'plan phases quarters roadmap', href: '/roadmap', hint: 'görünüm' },
  { id: 'nav-analytics', label: 'Analitik', keywords: 'metrics numbers analytics', href: '/analytics', hint: 'görünüm' },
  { id: 'nav-reference', label: 'Referans Modeli', keywords: 'domains business brm reference model', href: '/reference', hint: 'görünüm' },
  { id: 'nav-org', label: 'Organizasyon Şeması', keywords: 'org chart hierarchy departments tree structure leads specialists', href: '/org', hint: 'görünüm' },
  { id: 'nav-brain', label: 'G-Brain', keywords: 'brain knowledge core markdown vector pgvector supabase embeddings zeroentropy graph doctor', href: '/brain', hint: 'görünüm' },
  // Local apps discovered on this machine — open in a new tab
  { id: 'ext-command-center', label: 'Command Center', keywords: 'command-center kanban missions port 4000', href: 'http://localhost:4000', hint: 'localhost' },
  { id: 'ext-remotion', label: 'Remotion Studio', keywords: 'video render pipeline port 3789', href: 'http://localhost:3789', hint: 'localhost' },
  { id: 'ext-skool', label: 'Skool Community', keywords: 'launchpad cohort community posts', href: 'https://www.skool.com/launchpad-cohort', hint: 'web' },
  { id: 'ext-attio', label: 'Attio CRM', keywords: 'deals pipeline vantage', href: 'https://app.attio.com', hint: 'web' },
  { id: 'ext-fathom', label: 'Fathom Calls', keywords: 'meetings recordings notes', href: 'https://fathom.video', hint: 'web' },
];

function buildCommands(): Command[] {
  const db = getDb();
  const tools: Command[] = db.tools.all().map((t) => ({
    id: `tool-${t.id}`,
    label: t.name,
    keywords: `${t.category} ${t.description}`,
    href: '/integrations',
    hint: 'araç',
  }));
  const agents: Command[] = db.agents.all().map((a) => ({
    id: `agent-${a.id}`,
    label: a.name,
    keywords: `${a.role} ${a.description}`,
    href: '/agents',
    hint: 'ajan',
  }));
  return [...NAV_COMMANDS, ...agents, ...tools];
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={fontMono.variable} suppressHydrationWarning>
      <head>
        {/* Apply the persisted theme before first paint — no dark↔light flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <Sidebar />
        {/* os-shell yields to the Conductor dock: the panel sets --conductor-w
            and the whole content column glides left instead of being covered.
            marginLeft reads --sidebar-w (Sidebar.tsx sets it on collapse/resize)
            with the default width as a fallback for the first paint before
            that effect runs — a hardcoded ml-[232px] here would silently
            stop following the sidebar the moment it collapses or resizes
            (found live via Playwright: content stayed at the expanded
            margin while the sidebar shrank to its 56px icon rail). */}
        <div
          className="os-shell flex min-h-screen min-w-0 flex-col"
          style={{ marginLeft: 'var(--sidebar-w, 232px)', marginRight: 'var(--conductor-w, 0px)' }}
        >
          <Topbar />
          <main className="min-w-0 flex-1 px-4 pb-16 pt-7 sm:px-8 wide:px-10 ultra:px-12">
            {/* Width tiers: 1280 on laptops · 1760 on large monitors ·
                full-bleed on 32"/ultrawide. See tailwind screens wide/ultra. */}
            <div className="mx-auto max-w-[1280px] wide:max-w-[1760px] ultra:max-w-none">
              {children}
            </div>
          </main>
        </div>
        <CommandPalette commands={buildCommands()} />
        {/* Notion-style agent dock — the Conductor, aware of the current screen */}
        <ConductorPanel />
      </body>
    </html>
  );
}
