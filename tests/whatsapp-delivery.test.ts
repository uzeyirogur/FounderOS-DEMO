import { describe, it, expect, afterEach, vi } from 'vitest';
import { openDb, type FounderDb } from '@/lib/db';
import { runWhatsAppDeliveryTick } from '@/lib/whatsapp-delivery';

/**
 * The real WhatsApp delivery worker — polls db.notifications.pending()
 * for channel:'whatsapp' rows and sends each as a real WhatsApp Business
 * Cloud API template message (lib/connectors/whatsapp-cloud-send.ts).
 * Never fabricates delivery: honest skip reasons when unconfigured, real
 * per-notification send/fail outcomes when configured.
 */
describe('runWhatsAppDeliveryTick', () => {
  let db: FounderDb;
  const prevEnv = { ...process.env };
  afterEach(() => {
    db?.close();
    process.env = { ...prevEnv };
    vi.unstubAllGlobals();
  });

  it('does nothing and reports no skip reason when there are no whatsapp-channel notifications pending', async () => {
    db = openDb(':memory:');
    db.notifications.insert({
      id: 'n1', kind: 'daily_report', agentId: 'executive-reporter', title: 't', body: 'b',
      requiresApproval: false, status: 'pending', channel: 'local', createdAt: new Date().toISOString(),
      sentAt: null, decidedAt: null, decidedBy: null, responseText: null,
    });
    const result = await runWhatsAppDeliveryTick(db);
    expect(result.attempted).toBe(0);
    expect(result.skipped).toBeNull();
  });

  it('reports an honest skip when WhatsApp Cloud API credentials are not configured', async () => {
    db = openDb(':memory:');
    delete process.env.WHATSAPP_CLOUD_ACCESS_TOKEN;
    delete process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;
    db.notifications.insert({
      id: 'n1', kind: 'daily_report', agentId: 'executive-reporter', title: 't', body: 'b',
      requiresApproval: false, status: 'pending', channel: 'whatsapp', createdAt: new Date().toISOString(),
      sentAt: null, decidedAt: null, decidedBy: null, responseText: null,
    });
    const result = await runWhatsAppDeliveryTick(db);
    expect(result.attempted).toBe(0);
    expect(result.skipped).toMatch(/not configured/i);
    expect(db.notifications.byId('n1')?.status).toBe('pending'); // untouched, not fabricated as sent
  });

  it('reports an honest skip when credentials exist but destination/template are not set', async () => {
    db = openDb(':memory:');
    process.env.WHATSAPP_CLOUD_ACCESS_TOKEN = 'fake-token';
    process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID = '123456';
    delete process.env.WHATSAPP_REPORT_TO;
    delete process.env.WHATSAPP_REPORT_TEMPLATE_NAME;
    db.notifications.insert({
      id: 'n1', kind: 'daily_report', agentId: 'executive-reporter', title: 't', body: 'b',
      requiresApproval: false, status: 'pending', channel: 'whatsapp', createdAt: new Date().toISOString(),
      sentAt: null, decidedAt: null, decidedBy: null, responseText: null,
    });
    const result = await runWhatsAppDeliveryTick(db);
    expect(result.attempted).toBe(0);
    expect(result.skipped).toMatch(/WHATSAPP_REPORT_TO/);
  });

  it('sends real notifications and marks them sent when fully configured and the API succeeds', async () => {
    db = openDb(':memory:');
    process.env.WHATSAPP_CLOUD_ACCESS_TOKEN = 'fake-token';
    process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID = '123456';
    process.env.WHATSAPP_REPORT_TO = '+15551234567';
    process.env.WHATSAPP_REPORT_TEMPLATE_NAME = 'daily_report_v1';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: 'wamid.1' }] }) }));

    db.notifications.insert({
      id: 'n1', kind: 'daily_report', agentId: 'executive-reporter', title: 'Daily report', body: 'All good',
      requiresApproval: false, status: 'pending', channel: 'whatsapp', createdAt: new Date().toISOString(),
      sentAt: null, decidedAt: null, decidedBy: null, responseText: null,
    });
    const result = await runWhatsAppDeliveryTick(db);
    expect(result.attempted).toBe(1);
    expect(result.sent).toEqual(['n1']);
    expect(result.failed).toEqual([]);
    expect(db.notifications.byId('n1')?.status).toBe('sent');
    expect(db.notifications.byId('n1')?.sentAt).not.toBeNull();
  });

  it('marks a real API failure honestly as failed, never fabricates sent', async () => {
    db = openDb(':memory:');
    process.env.WHATSAPP_CLOUD_ACCESS_TOKEN = 'fake-token';
    process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID = '123456';
    process.env.WHATSAPP_REPORT_TO = '+15551234567';
    process.env.WHATSAPP_REPORT_TEMPLATE_NAME = 'daily_report_v1';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: { message: 'Template not approved' } }) }),
    );

    db.notifications.insert({
      id: 'n1', kind: 'alert', agentId: 'conductor', title: 'Alert', body: 'Something happened',
      requiresApproval: false, status: 'pending', channel: 'whatsapp', createdAt: new Date().toISOString(),
      sentAt: null, decidedAt: null, decidedBy: null, responseText: null,
    });
    const result = await runWhatsAppDeliveryTick(db);
    expect(result.attempted).toBe(1);
    expect(result.sent).toEqual([]);
    expect(result.failed).toEqual([{ id: 'n1', reason: 'Template not approved' }]);
    expect(db.notifications.byId('n1')?.status).toBe('failed');
  });

  it('never touches a local-channel notification, even alongside whatsapp-channel ones', async () => {
    db = openDb(':memory:');
    process.env.WHATSAPP_CLOUD_ACCESS_TOKEN = 'fake-token';
    process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID = '123456';
    process.env.WHATSAPP_REPORT_TO = '+15551234567';
    process.env.WHATSAPP_REPORT_TEMPLATE_NAME = 'daily_report_v1';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: 'wamid.1' }] }) }));

    db.notifications.insert({
      id: 'local1', kind: 'daily_report', agentId: 'executive-reporter', title: 't', body: 'b',
      requiresApproval: false, status: 'pending', channel: 'local', createdAt: new Date().toISOString(),
      sentAt: null, decidedAt: null, decidedBy: null, responseText: null,
    });
    db.notifications.insert({
      id: 'wa1', kind: 'daily_report', agentId: 'executive-reporter', title: 't', body: 'b',
      requiresApproval: false, status: 'pending', channel: 'whatsapp', createdAt: new Date().toISOString(),
      sentAt: null, decidedAt: null, decidedBy: null, responseText: null,
    });
    const result = await runWhatsAppDeliveryTick(db);
    expect(result.attempted).toBe(1);
    expect(result.sent).toEqual(['wa1']);
    expect(db.notifications.byId('local1')?.status).toBe('pending'); // untouched
  });
});
