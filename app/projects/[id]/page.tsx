import { notFound } from 'next/navigation';
import { getDb } from '@/lib/data';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/terminal';
import { ProjectLifecycleWidget } from '@/components/ProjectLifecycleWidget';
import { GrowthResearchPanel } from '@/components/GrowthResearchPanel';
import { projectLifecycleSummary } from '@/lib/project-lifecycle-orchestrator';

export const dynamic = 'force-dynamic';

/**
 * A single Project Registry entry's detail view: identity + the live
 * lifecycle rail (Project Lifecycle Orchestrator). Every project — no
 * matter which one — gets this same page; nothing here names a project.
 */
export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const db = getDb();
  const project = db.projects.all().find((p) => p.id === params.id);
  if (!project) notFound();

  const summary = projectLifecycleSummary(db, params.id);
  const agentNames = Object.fromEntries(db.agents.all().map((a) => [a.id, a.name]));
  const growthBriefs = db.growthBriefs.byProjectId(params.id);

  return (
    <div>
      <PageHeader
        eyebrow="project lifecycle"
        title={project.name}
        right={<Badge tone="accent">{project.status}</Badge>}
      />
      <p className="mb-4 max-w-[720px] text-[12.5px] leading-relaxed text-os-muted">
        {project.purpose || 'No purpose set.'} <span className="text-os-dim">— {project.pathOrUrl}</span>
      </p>
      <ProjectLifecycleWidget projectId={project.id} agentNames={agentNames} initial={summary} />
      <div className="mt-4">
        <GrowthResearchPanel projectId={project.id} briefs={growthBriefs} />
      </div>
    </div>
  );
}
