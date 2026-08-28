import { getDb } from '@/lib/data';
import { PageHeader } from '@/components/PageHeader';
import { WorkAssistantBoard } from '@/components/WorkAssistantBoard';
import { PersonalOpsBoard } from '@/components/PersonalOpsBoard';
import { currentStreak } from '@/lib/personal-ops';

export const dynamic = 'force-dynamic';

/**
 * Personal domain: Work Assistant's one-off task list and Personal Ops'
 * recurring routines — deliberately separate from the Project Registry.
 */
export default function WorkPage() {
  const db = getDb();
  const tasks = db.personalTasks.all();
  const today = new Date().toISOString().slice(0, 10);
  const routines = db.routines.all().map((r) => ({
    ...r,
    streak: currentStreak(db.routineCompletions.forRoutine(r.id).map((c) => c.completedOn), today),
  }));

  return (
    <div>
      <PageHeader eyebrow="work assistant" title="My Tasks" />
      <WorkAssistantBoard tasks={tasks} />

      <div className="mt-8">
        <PageHeader eyebrow="personal ops" title="Routines" />
        <PersonalOpsBoard routines={routines} />
      </div>
    </div>
  );
}
