'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus } from 'lucide-react';
import type { PersonalTask } from '@/lib/schemas';

const PRIORITY_TEXT: Record<string, string> = { high: 'text-os-err', normal: 'text-os-muted', low: 'text-os-dim' };

/** Complete-in-place button for one task. */
function TaskRow({ task }: { task: PersonalTask }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const complete = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/personal-tasks/${encodeURIComponent(task.id)}/complete`, { method: 'POST' });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex items-center justify-between gap-3 border-b border-os-border px-4 py-2.5 last:border-b-0">
      <div>
        <div className="text-[12.5px] text-os-text">{task.title}</div>
        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider">
          <span className={PRIORITY_TEXT[task.priority]}>{task.priority}</span>
          {task.dueAt && <span className="ml-2 text-os-dim">due {new Date(task.dueAt).toLocaleDateString()}</span>}
        </div>
      </div>
      <button
        onClick={complete}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-sm-t border border-os-border px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-os-ok disabled:opacity-40"
      >
        <Check className="h-3 w-3" /> done
      </button>
    </li>
  );
}

/** New-task form. */
function NewTaskForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/personal-tasks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, priority }),
      });
      if (res.ok) {
        setTitle('');
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 flex items-center gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New task…"
        className="flex-1 rounded-sm-t border border-os-border bg-os-surface px-3 py-1.5 text-[12.5px] text-os-text outline-none"
      />
      <select
        value={priority}
        onChange={(e) => setPriority(e.target.value as 'low' | 'normal' | 'high')}
        className="rounded-sm-t border border-os-border bg-os-surface px-2 py-1.5 font-mono text-[11px] uppercase tracking-wider text-os-muted"
      >
        <option value="low">low</option>
        <option value="normal">normal</option>
        <option value="high">high</option>
      </select>
      <button
        onClick={submit}
        disabled={busy || !title.trim()}
        className="inline-flex items-center gap-1 rounded-sm-t border border-os-border bg-os-surface2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-os-accent disabled:opacity-40"
      >
        <Plus className="h-3 w-3" /> add
      </button>
    </div>
  );
}

export function WorkAssistantBoard({ tasks }: { tasks: PersonalTask[] }) {
  const open = tasks.filter((t) => t.status === 'open');
  const done = tasks.filter((t) => t.status === 'done');
  return (
    <div>
      <NewTaskForm />
      {open.length === 0 ? (
        <p className="rounded-lg-t border border-os-border bg-os-surface px-4 py-3 font-mono text-[10.5px] text-os-dim">
          No open tasks.
        </p>
      ) : (
        <ul className="rounded-lg-t border border-os-border bg-os-surface">
          {open.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </ul>
      )}
      {done.length > 0 && (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-os-dim">{done.length} done</p>
      )}
    </div>
  );
}
