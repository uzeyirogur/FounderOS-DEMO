import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDb } from '@/lib/db';

describe('outboundMessages repo', () => {
  let db: ReturnType<typeof openDb>;
  beforeEach(() => { db = openDb(':memory:'); });
  afterEach(() => { (db as any).close?.(); });

  const now = new Date().toISOString();
  const base = {
    id: 'om1', channel: 'email' as const, to: 'x@example.com', subject: 'Hi', body: 'body',
    status: 'pending_approval' as const, createdAt: now, decidedAt: null, decidedBy: null, sentAt: null, failureReason: null,
  };

  it('starts empty', () => {
    expect(db.outboundMessages.all()).toEqual([]);
  });

  it('inserts and reads back a message', () => {
    db.outboundMessages.insert(base);
    expect(db.outboundMessages.byId('om1')?.channel).toBe('email');
  });

  it('lists only pending_approval via pending()', () => {
    db.outboundMessages.insert(base);
    db.outboundMessages.insert({ ...base, id: 'om2', status: 'sent' });
    expect(db.outboundMessages.pending().map((m) => m.id)).toEqual(['om1']);
  });

  it('decide() sets status/decidedAt/decidedBy', () => {
    db.outboundMessages.insert(base);
    db.outboundMessages.decide('om1', 'approved', 'local-ui');
    const row = db.outboundMessages.byId('om1');
    expect(row?.status).toBe('approved');
    expect(row?.decidedBy).toBe('local-ui');
  });

  it('markSent() and markFailed() set the terminal state honestly', () => {
    db.outboundMessages.insert(base);
    db.outboundMessages.markSent('om1');
    expect(db.outboundMessages.byId('om1')?.status).toBe('sent');

    db.outboundMessages.insert({ ...base, id: 'om3' });
    db.outboundMessages.markFailed('om3', 'no inbox configured');
    const row = db.outboundMessages.byId('om3');
    expect(row?.status).toBe('failed');
    expect(row?.failureReason).toBe('no inbox configured');
  });
});
