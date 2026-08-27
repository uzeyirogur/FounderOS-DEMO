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
      <PageHeader eyebrow="agent authorization" title="Projects" right={<Badge tone="accent">{active} active</Badge>} />
      <p className="mb-4 max-w-[720px] text-[12.5px] leading-relaxed text-os-muted">
        Every repo or folder an agent is allowed to work on, registered here — not hardcoded into agent
        logic. Registering a project grants no access by itself: an agent must be explicitly authorized at a
        permission level before it may touch it.
      </p>
      <NewProject />
      <ProjectsTable rows={rows} agentNames={agentNames} manage />
    </div>
  );
}
