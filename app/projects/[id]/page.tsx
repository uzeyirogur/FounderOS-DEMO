import { notFound } from 'next/navigation';
import { getDb } from '@/lib/data';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/terminal';
import { ProjectLifecycleWidget } from '@/components/ProjectLifecycleWidget';
import { GrowthResearchPanel } from '@/components/GrowthResearchPanel';
import { CreativeResearchPanel } from '@/components/CreativeResearchPanel';
import { ClaudeCodeDispatchPanel } from '@/components/ClaudeCodeDispatchPanel';
import { projectLifecycleSummary } from '@/lib/project-lifecycle-orchestrator';
import type { Project } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<Project['status'], string> = {
  active: 'Aktif',
  paused: 'Duraklatıldı',
  archived: 'Arşivlendi',
};

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
  const creativeBriefs = db.creativeBriefs.byProjectId(params.id);

  return (
    <div>
      <PageHeader
        eyebrow="proje yaşam döngüsü"
        title={project.name}
        right={<Badge tone="accent">{STATUS_LABEL[project.status]}</Badge>}
      />
      <p className="mb-4 max-w-[720px] text-[12.5px] leading-relaxed text-os-muted">
        {project.purpose || 'Amaç belirlenmemiş.'} <span className="text-os-dim">— {project.pathOrUrl}</span>
      </p>
      <ProjectLifecycleWidget projectId={project.id} agentNames={agentNames} initial={summary} />
      <div className="mt-4">
        <GrowthResearchPanel projectId={project.id} briefs={growthBriefs} />
      </div>
      <div className="mt-4">
        <CreativeResearchPanel projectId={project.id} briefs={creativeBriefs} />
      </div>
      {project.kind === 'local' && (
        <div className="mt-4">
          <ClaudeCodeDispatchPanel
            projectId={project.id}
            authorized={project.status === 'active' && project.authorizedAgentIds.includes('claude-code-orchestrator')}
          />
        </div>
      )}
    </div>
  );
}
