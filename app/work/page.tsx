import { getDb } from '@/lib/data';
import { PageHeader } from '@/components/PageHeader';
import { WorkAssistantBoard } from '@/components/WorkAssistantBoard';

export const dynamic = 'force-dynamic';

/**
 * Work Assistant: Alex's own task list, deliberately separate from the
 * Project Registry — nothing here becomes a project lifecycle.
 */
export default function WorkPage() {
  const tasks = getDb().personalTasks.all();
  return (
    <div>
      <PageHeader eyebrow="work assistant" title="My Tasks" />
      <WorkAssistantBoard tasks={tasks} />
    </div>
  );
}
