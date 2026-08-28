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
        eyebrow="shared infrastructure"
        title="Capability Registry"
        right={<Badge tone={pending > 0 ? 'warn' : 'accent'}>{pending} awaiting review</Badge>}
      />
      <p className="mb-4 max-w-[760px] text-[12.5px] leading-relaxed text-os-muted">
        Every MCP server, API, CLI, SDK, SKILL.md, GitHub repo, hosted service, or media-generation tool any agent
        has discovered or been given. AI Intelligence adds new rows as &apos;candidate&apos; when a task needs a
        capability nothing active covers — a paid or auth-required candidate never activates itself; approve it here
        first.
      </p>
      <CapabilityRegistryTable rows={rows} />
    </div>
  );
}
