/**
 * Single source of truth for the app's primary navigation. The Sidebar renders
 * these groups in order; the CommandPalette derives its digit (1–9) shortcuts
 * from the same visible order, so the two can never drift apart again.
 *
 * Turkish labels, trimmed primary group (2026-08-31 dashboard audit): the
 * operator-console redesign moved every non-essential/legacy route into
 * secondary groups so the sidebar reads "what do I actually check daily",
 * not every route this repo happens to have. No route was deleted — every
 * page below still exists and is reachable, just grouped honestly.
 */
import {
  Stethoscope,
  Home,
  MessageSquare,
  Share2,
  Clapperboard,
  Users,
  ListChecks,
  Sparkles,
  Network,
  Brain,
  Wallet,
  Filter,
  Workflow,
  Map,
  Plug,
  BarChart3,
  LayoutGrid,
  Layers,
  FolderGit2,
  Lightbulb,
  Bell,
  Boxes,
  Send,
  Mail,
  AlertTriangle,
} from 'lucide-react';

export type NavItem = { href: string; label: string; icon: typeof Home };

/** Primary group — the daily operator-console flow. */
export const NAV_OPERATE: NavItem[] = [
  { href: '/', label: 'Ana Sayfa', icon: Home },
  { href: '/projects', label: 'Projeler', icon: FolderGit2 },
  { href: '/tasks', label: 'Görevler', icon: ListChecks },
  { href: '/agents', label: 'Ajanlar', icon: Users },
  { href: '/notifications', label: 'Bildirimler ve Onaylar', icon: Bell },
  { href: '/monitoring', label: 'Raporlar', icon: AlertTriangle },
  { href: '/content', label: 'İçerik', icon: Clapperboard },
  { href: '/integrations', label: 'Bağlantılar', icon: Plug },
];

// Pages that exist but are reached via drill-down from their parent
// section rather than the primary sidebar (e.g. /content/lead-magnets
// from /content, /social/beehiiv from /social) are intentionally NOT
// duplicated here — the parent page links to them directly.

// Agent workforce detail: roster + skills + the org chart that maps how they report.
export const NAV_AGENTS: NavItem[] = [
  { href: '/skills', label: 'Beceriler', icon: Sparkles },
  { href: '/org', label: 'Organizasyon Şeması', icon: Network },
];

// The knowledge layer the agents draw on.
export const NAV_INTELLIGENCE: NavItem[] = [
  { href: '/brain', label: 'Bilgi Merkezi (G-Brain)', icon: Brain },
  { href: '/doctor', label: 'Sistem Sağlığı', icon: Stethoscope },
  { href: '/capabilities', label: 'Yetenek Kayıtları', icon: Boxes },
  { href: '/analytics', label: 'Analitik', icon: BarChart3 },
];

// Everything else this repo carries — reachable, just not part of the daily
// at-a-glance flow. Nothing here was deleted in the 2026-08-31 dashboard audit.
export const NAV_SYSTEM: NavItem[] = [
  { href: '/comms', label: 'İletişim', icon: MessageSquare },
  { href: '/funnel', label: 'Satış Hunisi', icon: Filter },
  { href: '/workflows', label: 'İş Akışları', icon: Workflow },
  { href: '/social', label: 'Sosyal Medya', icon: Share2 },
  { href: '/finances', label: 'Finans', icon: Wallet },
  { href: '/ideas', label: 'Fikir Laboratuvarı', icon: Lightbulb },
  { href: '/publish-plans', label: 'Yayın Planları', icon: Send },
  { href: '/outbound', label: 'Giden Mesajlar', icon: Mail },
  { href: '/work', label: 'Kişisel Görevlerim', icon: ListChecks },
  { href: '/roadmap', label: 'Yol Haritası', icon: Map },
  { href: '/reference', label: 'Referans Model', icon: LayoutGrid },
];

// At the very bottom: persona templates that can run variants of this platform.
export const NAV_LIBRARY: NavItem[] = [{ href: '/personas', label: 'Persona Şablonları', icon: Layers }];

/** Visible top-to-bottom order across all groups. */
export const NAV_ORDER: string[] = [
  ...NAV_OPERATE,
  ...NAV_AGENTS,
  ...NAV_INTELLIGENCE,
  ...NAV_SYSTEM,
  ...NAV_LIBRARY,
].map((n) => n.href);

/** Digit keys 1–9 jump to the first nine views in visible order. */
export const DIGIT_VIEWS: string[] = NAV_ORDER.slice(0, 9);
