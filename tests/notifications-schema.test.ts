import { describe, it, expect } from 'vitest';
import { NotificationSchema, NotificationKindSchema, NotificationStatusSchema } from '@/lib/schemas';

/**
 * The outbound-report / inbound-approval queue that will back the WhatsApp
 * reporting-and-approval channel (architecture-only for now; no WhatsApp
 * account is connected — see docs/WHATSAPP_CHANNEL_ARCHITECTURE.md).
 *
 * This queue is channel-agnostic on purpose: it is a local, always-on record
 * of "here is what an agent wants to tell Alex or ask Alex to decide",
 * independent of whether any delivery channel is wired up. A delivery
 * worker (WhatsApp today, could be email/Slack/SMS later) polls
 * status=pending and marks rows sent; a decision (approve/reject) can come
 * from that same channel OR from the local /notifications page — the
 * decide endpoint doesn't care which one it came from.
 */
describe('NotificationSchema', () => {
  const valid = {
    id: 'notif-1',
    kind: 'daily_report' as const,
    agentId: 'executive-reporter',
    title: 'Daily digest',
    body: '2 runs in the last 24h, 2 ok, 0 failed.',
    status: 'pending' as const,
    channel: 'whatsapp' as const,
    createdAt: '2026-08-28T08:00:00.000Z',
  };

  it('accepts a minimal valid notification and fills in defaults', () => {
    const parsed = NotificationSchema.parse(valid);
    expect(parsed.status).toBe('pending');
    expect(parsed.sentAt).toBeNull();
    expect(parsed.decidedAt).toBeNull();
    expect(parsed.decidedBy).toBeNull();
    expect(parsed.responseText).toBeNull();
    expect(parsed.requiresApproval).toBe(false);
  });

  it('rejects an empty title', () => {
    expect(() => NotificationSchema.parse({ ...valid, title: '' })).toThrow();
  });

  it('rejects an unknown kind', () => {
    expect(() => NotificationSchema.parse({ ...valid, kind: 'not-a-real-kind' })).toThrow();
  });

  it('accepts an approval_request kind with requiresApproval true', () => {
    const parsed = NotificationSchema.parse({
      ...valid,
      kind: 'approval_request',
      requiresApproval: true,
    });
    expect(parsed.requiresApproval).toBe(true);
  });

  it('every NotificationKind and NotificationStatus value round-trips', () => {
    for (const kind of NotificationKindSchema.options) {
      expect(() => NotificationSchema.parse({ ...valid, kind })).not.toThrow();
    }
    for (const status of NotificationStatusSchema.options) {
      expect(() => NotificationSchema.parse({ ...valid, status })).not.toThrow();
    }
  });
});
