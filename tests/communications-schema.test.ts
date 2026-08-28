import { describe, it, expect } from 'vitest';
import { OutboundMessageSchema, OutboundChannelSchema, OutboundStatusSchema } from '@/lib/schemas';

/**
 * Communications' real outbound capability: an agent may DRAFT a message
 * to a real person, but sending is always gated on explicit approval —
 * per the Approval Policy ("gerçek kişiye mail/WhatsApp gönderme" needs a
 * yes first). Mirrors PublishPlan's drafted -> pending_approval ->
 * approved/rejected -> sent/failed shape.
 */
describe('OutboundMessageSchema', () => {
  it('accepts a valid drafted email message', () => {
    const msg = OutboundMessageSchema.parse({
      id: 'm1',
      channel: 'email',
      to: 'someone@example.com',
      subject: 'Hello',
      body: 'Hi there',
      status: 'pending_approval',
      createdAt: new Date().toISOString(),
      decidedAt: null,
      decidedBy: null,
      sentAt: null,
      failureReason: null,
    });
    expect(msg.channel).toBe('email');
  });

  it('rejects an unknown channel', () => {
    expect(() =>
      OutboundMessageSchema.parse({
        id: 'm1', channel: 'carrier-pigeon', to: 'x', subject: null, body: 'x', status: 'drafted',
        createdAt: new Date().toISOString(), decidedAt: null, decidedBy: null, sentAt: null, failureReason: null,
      }),
    ).toThrow();
  });

  it('allows a whatsapp message without a subject', () => {
    const msg = OutboundMessageSchema.parse({
      id: 'm2', channel: 'whatsapp', to: '+15555550100', subject: null, body: 'Hi', status: 'drafted',
      createdAt: new Date().toISOString(), decidedAt: null, decidedBy: null, sentAt: null, failureReason: null,
    });
    expect(msg.subject).toBeNull();
  });

  it('enumerates the exact status lifecycle', () => {
    expect(OutboundStatusSchema.options).toEqual(['drafted', 'pending_approval', 'approved', 'rejected', 'sent', 'failed']);
  });

  it('enumerates exactly two channels today', () => {
    expect(OutboundChannelSchema.options).toEqual(['email', 'whatsapp']);
  });
});
