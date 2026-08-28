import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDb } from '@/lib/db';
import { draftOutboundMessage, attemptSend } from '@/lib/communications';

describe('draftOutboundMessage', () => {
  let db: ReturnType<typeof openDb>;
  beforeEach(() => { db = openDb(':memory:'); });
  afterEach(() => { (db as any).close?.(); });

  it('always starts at pending_approval — never auto-sent', () => {
    const msg = draftOutboundMessage(db, { channel: 'email', to: 'x@example.com', subject: 'Hi', body: 'hello' });
    expect(msg.status).toBe('pending_approval');
  });

  it('allows a whatsapp draft without a subject', () => {
    const msg = draftOutboundMessage(db, { channel: 'whatsapp', to: '+15555550100', subject: null, body: 'hi' });
    expect(msg.subject).toBeNull();
  });
});

describe('attemptSend', () => {
  let db: ReturnType<typeof openDb>;
  beforeEach(() => { db = openDb(':memory:'); });
  afterEach(() => { (db as any).close?.(); });

  it('refuses to send a message that is not approved', async () => {
    const msg = draftOutboundMessage(db, { channel: 'email', to: 'x@example.com', subject: 'Hi', body: 'hello' });
    const result = await attemptSend(db, msg.id, async () => ({ ok: true }));
    if (result.ok) throw new Error('expected attemptSend to be refused');
    expect(result.reason).toMatch(/not approved/i);
  });

  it('sends an approved message via the injected sendFn', async () => {
    const msg = draftOutboundMessage(db, { channel: 'email', to: 'x@example.com', subject: 'Hi', body: 'hello' });
    db.outboundMessages.decide(msg.id, 'approved', 'local-ui');
    const result = await attemptSend(db, msg.id, async () => ({ ok: true }));
    expect(result.ok).toBe(true);
    expect(db.outboundMessages.byId(msg.id)?.status).toBe('sent');
  });

  it('records a real send failure honestly', async () => {
    const msg = draftOutboundMessage(db, { channel: 'email', to: 'x@example.com', subject: 'Hi', body: 'hello' });
    db.outboundMessages.decide(msg.id, 'approved', 'local-ui');
    const result = await attemptSend(db, msg.id, async () => ({ ok: false, reason: 'no inbox configured' }));
    expect(result.ok).toBe(false);
    const row = db.outboundMessages.byId(msg.id);
    expect(row?.status).toBe('failed');
    expect(row?.failureReason).toBe('no inbox configured');
  });
});
