import { getDb } from '@/lib/data';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/terminal';
import { CapabilityRegistryTable } from '@/components/CapabilityRegistryTable';

export const dynamic = 'force-dynamic';

/**
 * The Capability / Tool Registry: every way of doing a thing any agent has
 * ever found or been given, from bare 'candidate' (AI Intelligence found it
 * via web search, nobody has decided anything yet) to 'active' (installed,
 * configured, and approved). This is the shared infrastructure the whole
 * Approval Policy hangs on — nothing paid or credentialed here can be used
 * by an agent until a human clicks approve.
 *
 * Status and category filters (image/video/3D/coding/research/social/
 * publishing/browser/audio/security/analytics) live in
 * CapabilityRegistryTable — category is derived from the real capability
 * tag, never a second field that could drift.
 */
export default function CapabilitiesPage() {
  const rows = getDb().capabilities.all();
  const pending = rows.filter((c) => c.status === 'candidate').length;

  return (
    <div>
      <PageHeader
        eyebrow="paylaşılan altyapı"
        title="Yetenek Kayıt Defteri"
        right={<Badge tone={pending > 0 ? 'warn' : 'accent'}>{pending} inceleme bekliyor</Badge>}
      />
      <p className="mb-4 max-w-[760px] text-[12.5px] leading-relaxed text-os-muted">
        Herhangi bir ajanın keşfettiği veya kendisine verilmiş her MCP sunucusu, API, CLI, SDK, SKILL.md, GitHub
        deposu, barındırılan servis veya medya üretim aracı. AI Intelligence, aktif hiçbir yetenek kapsamıyorsa bir
        görev için yeni satırları &apos;aday&apos; olarak ekler — ücretli veya kimlik doğrulama gerektiren bir aday
        kendiliğinden etkinleşmez; önce burada onaylanması gerekir.
      </p>
      <CapabilityRegistryTable rows={rows} />
    </div>
  );
}
