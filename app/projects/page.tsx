import { getDb } from '@/lib/data';
import { PageHeader } from '@/components/PageHeader';
import { NewProject } from '@/components/NewProject';
import { ProjectsTable } from '@/components/ProjectsTable';
import { Badge } from '@/components/terminal';

export const dynamic = 'force-dynamic';

/**
 * The Project Registry, full page. Every project any agent is allowed to
 * touch, dynamically — nothing here is hardcoded into agent logic. Add a
 * project, then grant it to specific agents at a specific permission level.
 */
export default function ProjectsPage() {
  const db = getDb();
  const rows = db.projects.all();
  const agentNames = Object.fromEntries(db.agents.all().map((a) => [a.id, a.name]));
  const active = rows.filter((r) => r.status === 'active').length;

  return (
    <div>
      <PageHeader eyebrow="ajan yetkilendirme" title="Projeler" right={<Badge tone="accent">{active} aktif</Badge>} />
      <p className="mb-4 max-w-[720px] text-[12.5px] leading-relaxed text-os-muted">
        Bir ajanın üzerinde çalışmasına izin verilen her repo veya klasör burada kayıtlıdır — ajan mantığına
        gömülü değildir. Bir projeyi kaydetmek tek başına erişim vermez: bir ajanın ona dokunabilmesi için
        önce açıkça bir yetki seviyesinde yetkilendirilmesi gerekir.
      </p>
      <NewProject />
      <ProjectsTable rows={rows} agentNames={agentNames} manage />
    </div>
  );
}
