import { NextResponse } from 'next/server';
import { getDb } from '@/lib/data';
import { runSchedulerTick } from '@/lib/scheduler/tick';
import { realAgents } from '@/lib/agents/real';

export const dynamic = 'force-dynamic';

/**
 * The scheduler's external-ticker entry point. Fires whatever enabled crons
 * are due right now and returns which ones ran. Same optional-shared-secret
 * pattern as the ManyChat webhook (app/api/webhooks/manychat/route.ts): if
 * SCHEDULER_TICK_SECRET is set, the caller must send a matching
 * x-scheduler-secret header. Unset (the default), any caller may tick —
 * acceptable because a tick only ever runs already-registered crons against
 * already-registered agents; it cannot create new capability.
 *
 * Today this is meant to be called by an out-of-process ticker (a Hermes
 * cronjob hitting this URL once a minute, or any cron-capable host running
 * `curl -X POST`). The dedicated host deploy replaces the external caller
 * with an in-process interval calling runSchedulerTick directly — this route
 * and lib/scheduler/tick.ts do not change either way.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.SCHEDULER_TICK_SECRET;
  if (secret && request.headers.get('x-scheduler-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await runSchedulerTick(getDb(), realAgents, new Date());
  return NextResponse.json(result);
}

/** Health check: how many crons are enabled and whether a secret is configured.
 *  Never claims 24/7 operation — that depends on an external ticker actually
 *  calling POST on a schedule, which this endpoint cannot observe. */
export async function GET(): Promise<Response> {
  const secret = process.env.SCHEDULER_TICK_SECRET;
  return NextResponse.json({
    ok: true,
    enabledCrons: getDb().agentCrons.allEnabled().length,
    secured: Boolean(secret),
    note:
      'This endpoint fires due crons when called; it does not call itself. ' +
      'An external ticker (cron job, scheduler) must POST here on an interval — ' +
      'without one, no cron ever runs regardless of how many are enabled.',
  });
}
