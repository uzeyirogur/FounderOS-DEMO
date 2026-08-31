'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, Plus } from 'lucide-react';
import type { Routine, RoutineFrequency } from '@/lib/schemas';

type RoutineWithStreak = Routine & { streak: number };

const FREQUENCY_LABEL: Record<RoutineFrequency, string> = {
  daily: 'günlük',
  weekdays: 'hafta içi',
  weekly: 'haftalık',
  monthly: 'aylık',
};

function RoutineRow({ routine }: { routine: RoutineWithStreak }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const checkIn = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/routines/${encodeURIComponent(routine.id)}/check-in`, { method: 'POST' });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex items-center justify-between gap-3 border-b border-os-border px-4 py-2.5 last:border-b-0">
      <div>
        <div className="text-[12.5px] text-os-text">{routine.title}</div>
        <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-os-dim">
          <span>{FREQUENCY_LABEL[routine.frequency] ?? routine.frequency}</span>
          <span className="inline-flex items-center gap-0.5 text-os-warn">
            <Flame className="h-3 w-3" /> {routine.streak}
          </span>
        </div>
      </div>
      <button
        onClick={checkIn}
        disabled={busy}
        className="rounded-sm-t border border-os-border bg-os-surface2 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-os-ok disabled:opacity-40"
      >
        yoklama ver
      </button>
    </li>
  );
}

function NewRoutineForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [frequency, setFrequency] = useState<RoutineFrequency>('daily');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/routines/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, frequency }),
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
        placeholder="Yeni rutin…"
        className="flex-1 rounded-sm-t border border-os-border bg-os-surface px-3 py-1.5 text-[12.5px] text-os-text outline-none"
      />
      <select
        value={frequency}
        onChange={(e) => setFrequency(e.target.value as RoutineFrequency)}
        className="rounded-sm-t border border-os-border bg-os-surface px-2 py-1.5 font-mono text-[11px] uppercase tracking-wider text-os-muted"
      >
        <option value="daily">günlük</option>
        <option value="weekdays">hafta içi</option>
        <option value="weekly">haftalık</option>
        <option value="monthly">aylık</option>
      </select>
      <button
        onClick={submit}
        disabled={busy || !title.trim()}
        className="inline-flex items-center gap-1 rounded-sm-t border border-os-border bg-os-surface2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-os-accent disabled:opacity-40"
      >
        <Plus className="h-3 w-3" /> ekle
      </button>
    </div>
  );
}

export function PersonalOpsBoard({ routines }: { routines: RoutineWithStreak[] }) {
  const active = routines.filter((r) => r.active);
  return (
    <div>
      <NewRoutineForm />
      {active.length === 0 ? (
        <p className="rounded-lg-t border border-os-border bg-os-surface px-4 py-3 font-mono text-[10.5px] text-os-dim">
          Aktif rutin yok.
        </p>
      ) : (
        <ul className="rounded-lg-t border border-os-border bg-os-surface">
          {active.map((r) => (
            <RoutineRow key={r.id} routine={r} />
          ))}
        </ul>
      )}
    </div>
  );
}
