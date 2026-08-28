import { afterEach, describe, expect, test } from 'vitest';
import { openDb, type FounderDb } from '@/lib/db';

let db: FounderDb;
afterEach(() => db?.close());

const base = {
  id: 'notif-1',
  kind: 'daily_report' as const,
  agentId: 'executive-reporter',
  title: 'Daily digest',
  body: 'summary text',
  status: 'pending' as const,
  channel: 'whatsapp' as const,
  createdAt: '2026-08-28T08:00:00.000Z',
  requiresApproval: false,
  sentAt: null,
  decidedAt: null,
  decidedBy: null,
  responseText: null,
};

describe('db.notifications', () => {
  test('inserts and reads back a notification', () => {
    db = openDb(':memory:');
    db.notifications.insert(base);
    const all = db.notifications.all();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe('Daily digest');
  });

  test('byId finds a single row', () => {
    db = openDb(':memory:');
    db.notifications.insert(base);
    expect(db.notifications.byId('notif-1')?.title).toBe('Daily digest');
    expect(db.notifications.byId('nope')).toBeNull();
  });

  test('pending() only returns status=pending rows', () => {
    db = openDb(':memory:');
    db.notifications.insert(base);
    db.notifications.insert({ ...base, id: 'notif-2', status: 'sent' });
    const pending = db.notifications.pending();
    expect(pending.map((n) => n.id)).toEqual(['notif-1']);
  });

  test('decide() sets status/decidedAt/decidedBy/responseText', () => {
    db = openDb(':memory:');
    db.notifications.insert({ ...base, kind: 'approval_request', requiresApproval: true });
    db.notifications.decide('notif-1', 'approved', 'whatsapp:+90500000001', 'yes go ahead');
    const row = db.notifications.byId('notif-1')!;
    expect(row.status).toBe('approved');
    expect(row.decidedBy).toBe('whatsapp:+90500000001');
    expect(row.responseText).toBe('yes go ahead');
    expect(row.decidedAt).not.toBeNull();
  });

  test('markSent() sets status=sent and sentAt', () => {
    db = openDb(':memory:');
    db.notifications.insert(base);
    db.notifications.markSent('notif-1');
    const row = db.notifications.byId('notif-1')!;
    expect(row.status).toBe('sent');
    expect(row.sentAt).not.toBeNull();
  });
});
