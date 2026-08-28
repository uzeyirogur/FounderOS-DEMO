import { z } from 'zod';
import { getBrainProvider } from '@/lib/brain';
import { createGBrainProvider } from '@/lib/connectors/gbrain';
import { parseInboxConfigs, unreadCounts } from '@/lib/connectors/email';
import { configuredProcessors, stripeSnapshot } from '@/lib/connectors/payments';
import { recentMessages } from '@/lib/connectors/slack';
import { recentPages } from '@/lib/connectors/notion';
import { zernioStatus } from '@/lib/connectors/zernio';
import { attioClients, attioStatus } from '@/lib/connectors/attio';
import { webinarjamStatus, listRegistrants } from '@/lib/connectors/webinarjam';
import { trakyoStatus } from '@/lib/connectors/trakyo';
import { arcadsStatus } from '@/lib/connectors/arcads';
import { whatsappStatus } from '@/lib/connectors/whatsapp';
import { wisprStatus } from '@/lib/connectors/wispr';
import { localStackStatus } from '@/lib/connectors/local-stack';
import { ankaAdminStatus, fetchAnkaBranches, fetchAnkaSports } from '@/lib/connectors/anka-admin';
import { githubStatus } from '@/lib/connectors/github';
import { webSearchStatus } from '@/lib/connectors/web-search';
import { anthropicUsageStatus } from '@/lib/connectors/anthropic-usage';
import { detectProjectStack } from '@/lib/project-bootstrap';
import { buildExecutiveReport } from '@/lib/agents/executive-report';
import { scoreIdea } from '@/lib/ideas';
import { getDb } from '@/lib/data';
import { randomUUID } from 'node:crypto';
import type { LlmToolSpec } from '@/lib/connectors/llm';
import type { AgentRunResult, RuntimeAgent } from '@/lib/agents/runtime';

/**
 * Queues a channel-agnostic notification (see lib/schemas.ts NotificationSchema
 * and docs/WHATSAPP_CHANNEL_ARCHITECTURE.md). Agents call this to hand off
 * something worth telling — or asking — Alex; a delivery worker for whichever
 * channel is actually configured (WhatsApp today: architecture-only, no
 * account connected) picks up pending rows independently. Never awaited by
 * run() callers beyond the insert — queueing must never block or fail an
 * agent's own work.
 */
function queueNotification(opts: {
  kind: 'daily_report' | 'alert' | 'approval_request';
  agentId: string;
  title: string;
  body: string;
  channel?: 'whatsapp' | 'local';
}): void {
  getDb().notifications.insert({
    id: randomUUID(),
    kind: opts.kind,
    agentId: opts.agentId,
    title: opts.title,
    body: opts.body,
    requiresApproval: opts.kind === 'approval_request',
    status: 'pending',
    channel: opts.channel ?? 'whatsapp',
    createdAt: new Date().toISOString(),
    sentAt: null,
    decidedAt: null,
    decidedBy: null,
    responseText: null,
  });
}

/**
 * The real agent roster. Every run() does actual work against a live system —
 * no seeded numbers. Agents whose connector lacks credentials fail honestly
 * with setup instructions instead of pretending.
 *
 * Top-level agents are instance slots: when the dedicated host is live each one
 * becomes its own Clawline / Claude Code process and respond() routes
 * to that instance instead of the builtin implementation.
 */

async function gmailRun(): Promise<AgentRunResult> {
  const inboxes = parseInboxConfigs(process.env);
  if (inboxes.length === 0) {
    return { ok: false, summary: 'No inboxes configured — set INBOX_1..4_HOST/_USER/_PASS in .env.local' };
  }
  const counts = await unreadCounts(process.env);
  const failed = counts.filter((c) => c.error);
  const total = counts.reduce((sum, c) => sum + c.unread, 0);
  return {
    ok: failed.length < counts.length,
    summary: counts
      .map((c) => `${c.inbox}: ${c.error ? `ERROR ${c.error.slice(0, 60)}` : `${c.unread} unread`}`)
      .join(' · ')
      .concat(` · total ${total} unread`),
    data: counts,
  };
}

async function whatsappRun(): Promise<AgentRunResult> {
  const status = await whatsappStatus();
  return { ok: status.state === 'connected', summary: status.detail, data: status.meta };
}

async function slackRun(): Promise<AgentRunResult> {
  if (!process.env.SLACK_BOT_TOKEN) {
    return { ok: false, summary: 'Slack not configured — set SLACK_BOT_TOKEN in .env.local' };
  }
  const messages = await recentMessages(10);
  return {
    ok: true,
    summary: `${messages.length} recent messages across ${new Set(messages.map((m) => m.channel)).size} channels`,
    data: messages,
  };
}

async function zernioRun(): Promise<AgentRunResult> {
  const status = await zernioStatus();
  return { ok: status.state === 'connected', summary: status.detail, data: status.meta };
}

async function arcadsRun(): Promise<AgentRunResult> {
  const status = await arcadsStatus();
  return { ok: status.state === 'connected', summary: status.detail, data: status.meta };
}

const label = (r: AgentRunResult) => (r.ok ? 'LIVE' : 'DOWN');

const envIntegrationRun =
  (name: string, envKey: string, purpose: string) =>
  async (): Promise<AgentRunResult> => {
    if (!process.env[envKey]) {
      return { ok: false, summary: `${name} not configured — set ${envKey} · ${purpose}` };
    }
    return { ok: true, summary: `${name} credential present · ${purpose}` };
  };

const plannedLaneRun =
  (name: string, detail: string) =>
  async (): Promise<AgentRunResult> => ({ ok: false, summary: `${name} lane planned — ${detail}` });

async function stripeSalesRun(): Promise<AgentRunResult> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { ok: false, summary: 'Stripe sales checks not configured — set STRIPE_SECRET_KEY in .env.local' };
  }
  const snapshot = await stripeSnapshot(process.env);
  return {
    ok: true,
    summary: `Stripe sales payments: ${snapshot.recentCharges.length} recent charges available for confirmation`,
    data: snapshot,
  };
}

async function processorConfirmationRun(): Promise<AgentRunResult> {
  const configured = configuredProcessors(process.env).filter((p) => p.configured);
  if (configured.length === 0) {
    return { ok: false, summary: 'No payment processor APIs configured yet — start with STRIPE_SECRET_KEY' };
  }
  return {
    ok: true,
    summary: `${configured.map((p) => p.name).join(', ')} configured for payment confirmation`,
    data: configured,
  };
}

export const realAgents: RuntimeAgent[] = [
  // ── Command ──────────────────────────────────────────────────────────
  {
    id: 'conductor',
    name: 'Conductor',
    description: 'Broadcast fan-out + instance host availability (Clawline gateway, Ollama, tmux) for future bindings.',
    departmentId: 'dept-tech',
    async run() {
      const stack = await localStackStatus();
      return {
        ok: stack.state === 'connected',
        summary: `Instance hosts on this machine: ${stack.detail} · all agents bound to builtin runtime until the dedicated host lands`,
        data: stack.meta,
      };
    },
  },

  // ── Comms instance + channel workers ─────────────────────────────────
  {
    id: 'comms-agent',
    name: 'Comms Agent',
    description: 'Aggregates the Gmail/WhatsApp/Slack workers that feed the unified /comms view.',
    departmentId: 'dept-comms',
    async run() {
      const [gmail, whatsapp, slack] = await Promise.all([gmailRun(), whatsappRun(), slackRun()]);
      const live = [gmail, whatsapp, slack].filter((r) => r.ok).length;
      return {
        ok: live > 0,
        summary: `${live}/3 channels live → /comms · Gmail ${label(gmail)} · WhatsApp ${label(whatsapp)} · Slack ${label(slack)}`,
        data: { gmail, whatsapp, slack },
      };
    },
  },
  { id: 'gmail-worker', name: 'Gmail Worker', description: 'Unread counts and recent mail from up to four IMAP inboxes.', departmentId: 'dept-comms', run: gmailRun },
  { id: 'whatsapp-worker', name: 'WhatsApp Worker', description: 'Local WhatsApp ChatStorage, read-only.', departmentId: 'dept-comms', run: whatsappRun },
  { id: 'slack-worker', name: 'Slack Worker', description: 'Latest messages across joined Slack channels.', departmentId: 'dept-comms', run: slackRun },

  // ── Studio instance + content workers ────────────────────────────────
  {
    id: 'social-agent',
    name: 'Social Agent',
    description: 'Aggregates the Postly publishing and Adsmith ad-generation workers.',
    departmentId: 'dept-marketing-growth',
    async run() {
      const [postly, adsmith] = await Promise.all([zernioRun(), arcadsRun()]);
      const live = [postly, adsmith].filter((r) => r.ok).length;
      const queued = getDb().socialPosts.queued().length;
      const queueNote = queued > 0 ? `${queued} post${queued === 1 ? '' : 's'} queued for publish` : 'no posts queued';
      return {
        ok: live > 0,
        summary: `${live}/2 core content APIs live · Postly ${label(postly)} · Adsmith ${label(adsmith)} · ${queueNote}`,
        data: { postly, adsmith, queuedPosts: queued },
      };
    },
  },
  { id: 'postly-publisher', name: 'Postly Publisher', description: 'Six platforms under @founderos.ai via Postly.', departmentId: 'dept-marketing-growth', run: zernioRun },
  { id: 'adsmith-creative', name: 'Adsmith Creative', description: 'UGC ads for Vantage via the Adsmith API.', departmentId: 'dept-marketing-growth', run: arcadsRun },
  {
    id: 'reelkit-editor',
    name: 'Reelkit Editor',
    description: 'Editing and rendering pipeline for social clips, captions, and promotional cuts.',
    departmentId: 'dept-marketing-growth',
    async run() {
      const stack = await localStackStatus();
      return {
        ok: stack.state === 'connected',
        summary: `Reelkit/social editing lane mapped · local stack: ${stack.detail}`,
        data: stack.meta,
      };
    },
  },
  {
    id: 'renderly-creative',
    name: 'Renderly Creative',
    description: 'Renderly creative generation for campaign visuals and product assets.',
    departmentId: 'dept-marketing-growth',
    async run() {
      const stack = await localStackStatus();
      return {
        ok: stack.state === 'connected',
        summary: `Renderly creative lane mapped · local stack: ${stack.detail}`,
        data: stack.meta,
      };
    },
  },
  {
    id: 'dmflow-mcp',
    name: 'DMFlow MCP',
    description: 'DMFlow MCP/API lane for social DM automations and lead capture.',
    departmentId: 'dept-marketing-growth',
    run: envIntegrationRun('DMFlow', 'MANYCHAT_API_KEY', 'DM automation and lead capture'),
  },

  // ── Sales instance + pipeline worker ─────────────────────────────────
  {
    id: 'sales-agent',
    name: 'Sales Agent',
    description: 'Aggregates the revenue pipeline workers for Sales.',
    departmentId: 'dept-sales',
    async run() {
      const [crm, processors] = await Promise.all([attioStatus(), processorConfirmationRun()]);
      return {
        ok: crm.state === 'connected' || processors.ok,
        summary: `Sales pipeline · Ledger ${crm.state === 'connected' ? 'LIVE' : 'DOWN'} · processors ${label(processors)} · PayKit/FlexPay/calls lanes mapped`,
        data: { crm, processors },
      };
    },
  },
  {
    id: 'launchpad-cohort-sales',
    name: 'Launchpad Cohort',
    description:
      'Launchpad Cohort sales lane: WebinarJam funnel (registrants/attendees → leads), Trakyo revenue attribution, plus offer/call/payment context.',
    departmentId: 'dept-sales',
    async run() {
      const [webinar, trakyo] = await Promise.all([webinarjamStatus(), trakyoStatus()]);
      const live = [webinar, trakyo].filter((s) => s.state === 'connected').length;
      return {
        ok: live > 0,
        summary: `Launchpad Cohort · WebinarJam ${webinar.state} · Trakyo ${trakyo.state}${
          live === 0 ? ' — set WEBINARJAM_API_KEY to pull webinar leads' : ''
        }`,
        data: { webinar, trakyo },
      };
    },
    chatTools(): LlmToolSpec[] {
      return [
        {
          name: 'searchWebinarRegistrants',
          description:
            "List registrants/attendees for an Launchpad Cohort WebinarJam session (these are leads). Read-only. Needs the webinar's id and schedule id.",
          parameters: z.object({
            webinarId: z.string().describe('WebinarJam webinar_id'),
            scheduleId: z.string().describe('WebinarJam schedule_id for the session'),
          }),
          execute: async (args) => {
            const webinarId = typeof args.webinarId === 'string' ? args.webinarId : '';
            const scheduleId = typeof args.scheduleId === 'string' ? args.scheduleId : '';
            if (!webinarId || !scheduleId) return { error: 'webinarId and scheduleId are required' };
            const registrants = await listRegistrants(webinarId, scheduleId);
            return { count: registrants.length, registrants: registrants.slice(0, 25) };
          },
        },
      ];
    },
  },
  {
    id: 'vantage-sales',
    name: 'Vantage',
    description: 'Vantage sales lane: pipeline, PayKit context, payments, and call data.',
    departmentId: 'dept-sales',
    run: plannedLaneRun('Vantage sales', 'connect Vantage-specific CRM/payment/call sources'),
  },
  {
    id: 'paykit-sales',
    name: 'PayKit',
    description: 'PayKit offer/payment/customer context for Sales.',
    departmentId: 'dept-sales',
    run: envIntegrationRun('PayKit', 'FANBASIS_API_KEY', 'offers, customers, and payment context'),
  },
  {
    id: 'vantage-paykit',
    name: 'Vantage PayKit',
    description: 'PayKit lane specifically under Vantage.',
    departmentId: 'dept-sales',
    run: envIntegrationRun('Vantage PayKit', 'FANBASIS_API_KEY', 'Vantage offer/payment context'),
  },
  { id: 'stripe-sales', name: 'Stripe', description: 'Stripe payment confirmation for sales workflows.', departmentId: 'dept-sales', run: stripeSalesRun },
  {
    id: 'processor-confirmation',
    name: 'Processor Confirm',
    description: 'Confirms payment states across configured processor APIs.',
    departmentId: 'dept-sales',
    run: processorConfirmationRun,
  },
  {
    id: 'flexpay-financing',
    name: 'FlexPay Financing',
    description: 'FlexPay financing options for offers and payment plans.',
    departmentId: 'dept-sales',
    run: envIntegrationRun('FlexPay', 'FlexPay_API_KEY', 'financing options for sales offers'),
  },
  {
    id: 'sales-calls-data',
    name: 'Sales Calls Data',
    description: 'Sales call recordings, notes, outcomes, and follow-up context.',
    departmentId: 'dept-sales',
    run: envIntegrationRun('Sales calls data', 'FATHOM_API_KEY', 'call recordings, summaries, and follow-up context'),
  },

  // ── Knowledge: the G-Brain analyst and its auditors ──────────────────
  {
    id: 'data-agent',
    name: 'Data Agent',
    description: 'Analyzes markdown + vector storage health and surfaces ideas; answers broadcasts by querying G-Brain.',
    departmentId: 'dept-tech',
    async run() {
      const overview = await createGBrainProvider().overview();
      const { store, doctor } = overview;
      const warnings = doctor.checks.filter((c) => c.status !== 'ok');
      const biggest = [...store.folders].sort((a, b) => b.files - a.files)[0];
      const inbox = store.folders.find((f) => f.name === 'inbox');

      const ideas: string[] = [];
      if (!doctor.connected) ideas.push('gbrain CLI unreachable — check the binary before trusting vector queries');
      if (doctor.connected && warnings.length > 0)
        ideas.push(`${warnings.length} doctor check(s) need attention (${warnings.map((w) => w.name).join(', ')})`);
      if (inbox && inbox.files > 3) ideas.push(`inbox/ holds ${inbox.files} unprocessed pages — file or archive them`);
      if (store.totalFiles < 50)
        ideas.push(`only ${store.totalFiles} pages on disk vs ~1240 in Supabase — run \`gbrain export\` to restore locally`);
      if (ideas.length === 0) ideas.push('storage healthy — no action needed');

      return {
        ok: doctor.connected,
        summary: `${doctor.detail} · ${store.totalFiles} md pages (largest: ${biggest?.name ?? 'n/a'} ${biggest?.files ?? 0}) · ideas: ${ideas.join(' | ')}`,
        data: { overview, ideas },
      };
    },
    async respond(message: string) {
      const results = await getBrainProvider().search(message);
      if (results.length === 0) {
        return { ok: false, summary: `Nothing in G-Brain matches "${message.slice(0, 80)}"` };
      }
      return {
        ok: true,
        summary: results
          .slice(0, 3)
          .map((r) => `${r.title}: ${r.snippet.slice(0, 100)}`)
          .join(' · '),
        data: results,
      };
    },
    chatTools(): LlmToolSpec[] {
      return [
        {
          name: 'searchGBrain',
          description:
            'Search the G-Brain knowledge base (brain-store markdown + vector store) and return the top matching notes. Read-only.',
          parameters: z.object({ query: z.string().describe('what to look up in the knowledge base') }),
          execute: async (args) => {
            const query = typeof args.query === 'string' ? args.query : '';
            const results = await getBrainProvider().search(query);
            return results.slice(0, 5);
          },
        },
      ];
    },
  },
  {
    id: 'markdown-auditor',
    name: 'Markdown Auditor',
    description: 'Page counts per brain-store folder, strays at the root.',
    departmentId: 'dept-tech',
    async run() {
      const { store } = await createGBrainProvider().overview();
      if (store.totalFiles === 0) {
        return { ok: false, summary: `brain-store empty or unreadable at ${store.path}` };
      }
      const root = store.folders.find((f) => f.name === '(root)');
      return {
        ok: true,
        summary: `${store.totalFiles} pages across ${store.folders.length} folders${root ? ` · ${root.files} stray at root` : ''} · ${store.folders.map((f) => `${f.name}:${f.files}`).join(' ')}`,
        data: store,
      };
    },
  },
  {
    id: 'vector-auditor',
    name: 'Vector Auditor',
    description: 'gbrain doctor: Supabase pgvector connection, embeddings, health score.',
    departmentId: 'dept-tech',
    async run() {
      const { doctor } = await createGBrainProvider().overview();
      const warn = doctor.checks.filter((c) => c.status !== 'ok');
      return {
        ok: doctor.connected,
        summary: doctor.connected
          ? `health ${doctor.healthScore ?? '?'}/100 · ${doctor.checks.length} checks, ${warn.length} warning(s)${warn.length ? `: ${warn.map((w) => w.name).join(', ')}` : ''}`
          : `doctor offline — ${doctor.detail}`,
        data: doctor,
      };
    },
  },
  {
    id: 'notion-sync',
    name: 'Notion Sync',
    description: 'Lists the most recently edited Notion pages shared with the integration.',
    departmentId: 'dept-tech',
    async run() {
      if (!process.env.NOTION_API_KEY) {
        return { ok: false, summary: 'Notion not configured — set NOTION_API_KEY in .env.local' };
      }
      const pages = await recentPages(10);
      return {
        ok: true,
        summary: `${pages.length} recently edited pages · latest: ${pages[0]?.title ?? 'none'}`,
        data: pages,
      };
    },
  },

  // ── Finance ──────────────────────────────────────────────────────────
  {
    id: 'payments-pulse',
    name: 'Payments Pulse',
    description: 'Verifies payment processor connections and reports Stripe balance + recent charges.',
    departmentId: 'dept-finance',
    async run() {
      const configured = configuredProcessors(process.env).filter((p) => p.configured);
      if (configured.length === 0) {
        return { ok: false, summary: 'No payment processors configured — start with STRIPE_SECRET_KEY in .env.local' };
      }
      if (configured.some((p) => p.id === 'stripe')) {
        const snapshot = await stripeSnapshot(process.env);
        const available = snapshot.available[0];
        return {
          ok: true,
          summary: `Stripe: ${((available?.amount ?? 0) / 100).toFixed(2)} ${(available?.currency ?? 'usd').toUpperCase()} available · ${snapshot.recentCharges.length} recent charges`,
          data: snapshot,
        };
      }
      return { ok: true, summary: `${configured.map((p) => p.name).join(', ')} configured (no live client yet)` };
    },
  },
  {
    id: 'crm-pulse',
    name: 'Ledger CRM',
    description: 'Queries the Ledger deals pipeline (Vantage + Launchpad Cohort). Read-scoped.',
    departmentId: 'dept-sales',
    async run() {
      const status = await attioStatus();
      return { ok: status.state === 'connected', summary: status.detail, data: status.meta };
    },
  },

  // ── Clients ──────────────────────────────────────────────────────────
  {
    id: 'client-roster',
    name: 'Client Roster',
    description: 'The live client list: funnel journeys reconciled with Ledger, counted by venture and status.',
    departmentId: 'dept-clients',
    async run() {
      const db = getDb();
      const journeys = db.funnel.journeys();
      const converted = journeys.filter((j) => j.status === 'converted');
      const live = await attioClients();
      const servingAttio = live.state === 'connected' && live.clients.length > 0;
      const byVenture = new Map<string, number>();
      for (const j of converted) byVenture.set(j.venture, (byVenture.get(j.venture) ?? 0) + 1);
      const ventures = [...byVenture.entries()].map(([v, n]) => `${v} ${n}`).join(' · ') || 'none yet';
      return {
        ok: true,
        summary: servingAttio
          ? `Serving Ledger live: ${live.clients.length} deals on the roster · funnel backup holds ${converted.length} clients`
          : `Serving seeded funnel: ${converted.length} clients (${ventures}) · ${journeys.length - converted.length} in pipeline · Ledger ${live.state}`,
        data: {
          source: servingAttio ? 'ledger' : 'funnel',
          ledger: { state: live.state, deals: live.clients.length },
          clients: converted.map((j) => ({ id: j.id, name: j.name, venture: j.venture, amountUsd: j.amountUsd })),
        },
      };
    },
  },
  {
    id: 'client-onboarding',
    name: 'Onboarding Agent',
    description: 'Readiness check for the onboarding SOP: the Ledger trigger plus the Slack and Notion workspaces it provisions.',
    departmentId: 'dept-clients',
    async run() {
      const { slackStatus } = await import('@/lib/connectors/slack');
      const { notionStatus } = await import('@/lib/connectors/notion');
      const [ledger, slack, notion] = await Promise.all([attioStatus(), slackStatus(), notionStatus()]);
      const live = [ledger, slack, notion].filter((s) => s.state === 'connected').length;
      return {
        ok: live > 0,
        summary: `Onboarding rails: Ledger ${ledger.state} · Slack ${slack.state} · Notion ${notion.state}${
          live < 3 ? ' — connect the missing rail to run onboarding end to end' : ''
        }`,
        data: { ledger: ledger.state, slack: slack.state, notion: notion.state },
      };
    },
  },
  {
    id: 'client-success',
    name: 'Client Success',
    description: 'Servicing rails: Recall call notes for deliverable tracking plus Slack for the check-in cadence.',
    departmentId: 'dept-clients',
    async run() {
      const { slackStatus } = await import('@/lib/connectors/slack');
      const slack = await slackStatus();
      const recall = process.env.FATHOM_API_KEY ? 'configured' : 'not_configured';
      const live = (slack.state === 'connected' ? 1 : 0) + (recall === 'configured' ? 1 : 0);
      return {
        ok: live > 0,
        summary: `Servicing rails: Recall ${recall} · Slack ${slack.state}${
          live === 0 ? ' — set FATHOM_API_KEY and a Slack bot token to service clients' : ''
        }`,
        data: { recall, slack: slack.state },
      };
    },
  },

  // ── Automations ──────────────────────────────────────────────────────
  {
    id: 'stack-monitor',
    name: 'Stack Monitor',
    description: 'Live check of the local creative/infra stack: Reelkit, Ollama, command-center, Clawline, tmux, whisper, ffmpeg, renderly, gh.',
    departmentId: 'dept-tech',
    async run() {
      const [stack, dictate] = await Promise.all([localStackStatus(), wisprStatus()]);
      return {
        ok: stack.state === 'connected',
        summary: `${stack.detail} · Dictate: ${dictate.state === 'connected' ? dictate.detail : dictate.state}`,
        data: { stack: stack.meta, dictate: dictate.meta },
      };
    },
  },

  // ── ANKA Operations ──────────────────────────────────────────────────────
  {
    id: 'anka-operations',
    name: 'ANKA Operations',
    description: 'Read-only view into the ANKA+/TIVARO backend Admin API — never finance (D-134 in that repo).',
    departmentId: 'dept-anka-ops',
    async run() {
      const status = await ankaAdminStatus();
      if (status.state !== 'connected') {
        return { ok: false, summary: status.detail, data: status.meta };
      }
      const baseUrl = process.env.ANKA_ADMIN_BASE_URL!;
      const token = process.env.ANKA_ADMIN_TOKEN!;
      try {
        const [branches, sports] = await Promise.all([
          fetchAnkaBranches(baseUrl, token),
          fetchAnkaSports(baseUrl, token),
        ]);
        return {
          ok: true,
          summary: `${status.detail} · ${branches.length} branch(es) · ${sports.length} sport(s).`,
          data: { dashboard: status.meta, branches, sports },
        };
      } catch (err) {
        return {
          ok: false,
          summary: `Dashboard reachable but branches/sports probe failed: ${err instanceof Error ? err.message : String(err)}`,
          data: status.meta,
        };
      }
    },
  },

  // ── Product & Engineering ────────────────────────────────────────────────
  {
    id: 'claude-code-orchestrator',
    name: 'Claude Code Orchestrator',
    description:
      "Dispatches coding work against the Project Registry's authorized targets, gated by each project's permissionLevel.",
    departmentId: 'dept-product-eng',
    async run() {
      const projects = getDb().projects.all();
      const active = projects.filter((p) => p.status === 'active');
      const authorized = active.filter((p) => p.authorizedAgentIds.includes('claude-code-orchestrator'));
      const byLevel = authorized.reduce<Record<string, number>>((acc, p) => {
        acc[p.permissionLevel] = (acc[p.permissionLevel] ?? 0) + 1;
        return acc;
      }, {});
      return {
        ok: true,
        summary:
          authorized.length === 0
            ? `0/${active.length} active projects authorize this agent — grant access from /projects to enable coding work.`
            : `${authorized.length}/${active.length} active projects authorized · ${Object.entries(byLevel)
                .map(([lvl, n]) => `${lvl}: ${n}`)
                .join(' · ')}`,
        data: { active: active.length, authorized: authorized.length, byLevel },
      };
    },
  },
  {
    id: 'qa-ui-review',
    name: 'QA & UI/UX Review',
    description: "Digest of this repo's own test/typecheck output — parsed, never re-implemented.",
    departmentId: 'dept-product-eng',
    async run() {
      return {
        ok: true,
        summary:
          'Run `npm test -- --reporter=json` and `npm run typecheck`, then paste the output into chat with this agent — ' +
          'it parses real vitest/tsc output (lib/qa-review.ts) rather than guessing pass/fail.',
      };
    },
  },
  {
    id: 'product-competitor-research',
    name: 'Product & Competitor Research',
    description: 'Web research via Brave Search for competitor moves and market context.',
    departmentId: 'dept-product-eng',
    async run() {
      const status = await webSearchStatus();
      return { ok: status.state === 'connected', summary: status.detail, data: status.meta };
    },
    chatTools(): LlmToolSpec[] {
      return [
        {
          name: 'searchWeb',
          description: 'Search the web via Brave Search for competitor/market research. Read-only.',
          parameters: z.object({ query: z.string().describe('what to search for') }),
          execute: async (args) => {
            const { braveSearch } = await import('@/lib/connectors/web-search');
            const key = process.env.BRAVE_SEARCH_API_KEY;
            if (!key) return { error: 'BRAVE_SEARCH_API_KEY not set' };
            const query = typeof args.query === 'string' ? args.query : '';
            return braveSearch(query, key, 5);
          },
        },
      ];
    },
  },
  {
    id: 'project-bootstrap',
    name: 'Project Bootstrap',
    description: "Detects a registered local project's real stack from its manifest files and recommends a starter checklist.",
    departmentId: 'dept-product-eng',
    async run() {
      const projects = getDb().projects.all().filter((p) => p.kind === 'local');
      if (projects.length === 0) {
        return { ok: false, summary: 'No local projects registered yet — add one at /projects.' };
      }
      const reports = projects.map((p) => ({ id: p.id, name: p.name, stack: detectProjectStack(p.pathOrUrl) }));
      const detected = reports.filter((r) => r.stack.languages.length > 0);
      return {
        ok: true,
        summary: `${detected.length}/${reports.length} local projects have a recognizable stack: ${detected
          .map((r) => `${r.name} (${r.stack.languages.join(', ')})`)
          .join(' · ') || 'none yet'}`,
        data: reports,
      };
    },
  },

  // ── AI Intelligence ───────────────────────────────────────────────────────
  {
    id: 'ai-intelligence',
    name: 'AI Intelligence',
    description:
      'Watches GitHub for new AI tools, MCP servers, and SKILL.md patterns worth adopting; on request, discovers a specific missing capability (MCP server, API, CLI, SDK, hosted service, media-generation tool, etc.) via live web search and adds candidates to the Capability Registry for review — never activates a paid/credentialed option on its own.',
    departmentId: 'dept-ai-intelligence',
    async run() {
      const status = await githubStatus();
      return { ok: status.state === 'connected', summary: status.detail, data: status.meta };
    },
    chatTools(): LlmToolSpec[] {
      return [
        {
          name: 'discoverCapability',
          description:
            "Look up whether the Capability Registry already has an active tool for a need (e.g. 'video-generation', 'carousel-design', '3d-web-animation'). If nothing active exists, search the web for current options and add them to the registry as candidates for review — never activates anything. Use this instead of saying 'I can't do that' when a task needs a capability the agent doesn't have.",
          parameters: z.object({
            capability: z.string().describe("short capability tag, e.g. 'video-generation'"),
            searchQuery: z.string().describe('the web search query to run if no active provider exists'),
          }),
          execute: async (args) => {
            const capability = typeof args.capability === 'string' ? args.capability : '';
            const searchQuery = typeof args.searchQuery === 'string' ? args.searchQuery : capability;
            const { discoverCapabilityLive } = await import('@/lib/capability-discovery');
            const result = await discoverCapabilityLive(getDb(), capability, searchQuery);
            return result;
          },
        },
        {
          name: 'listCapabilityCandidates',
          description: 'List every Capability Registry row for a given capability tag (active + candidates), for comparison before a decision.',
          parameters: z.object({ capability: z.string() }),
          execute: async (args) => {
            const capability = typeof args.capability === 'string' ? args.capability : '';
            return getDb().capabilities.byCapability(capability);
          },
        },
      ];
    },
  },

  // ── Social Content Studio ────────────────────────────────────────────────
  {
    id: 'social-content-studio',
    name: 'Social Content Studio',
    description:
      'Produces the full content surface (posts, carousels, ad creative, product demo videos, motion content, images, mockups, landing-page creative, voiceover, animation, 3D/web interactive) — text-native kinds go straight through the LLM gateway; every media kind checks the Capability Registry for a real active tool first, and runs live discovery if nothing is active yet. Never fakes media it did not actually produce.',
    departmentId: 'dept-content-studio',
    async run() {
      const db = getDb();
      const needing = db.contentPieces.needsCapability();
      const total = db.contentPieces.all().length;
      return {
        ok: true,
        summary:
          total === 0
            ? 'No content pieces yet — use the chat tool produceContent to draft one.'
            : `${total} content piece(s) tracked · ${needing.length} waiting on a Capability Registry decision.`,
        data: { total, needsCapability: needing },
      };
    },
    chatTools(): LlmToolSpec[] {
      return [
        {
          name: 'produceContent',
          description:
            'Produce one piece of content from a brief: a social_post or carousel is written directly; every other kind (ad_creative, product_demo_video, motion_content, short_video, image, mockup, landing_page_creative, voiceover, animation, 3d_web_interactive) checks the Capability Registry for a real tool and runs discovery if none is active — it never fabricates media. Optionally link it to a Project Registry project.',
          parameters: z.object({
            kind: z.enum([
              'social_post', 'carousel', 'ad_creative', 'product_demo_video', 'motion_content',
              'short_video', 'image', 'mockup', 'landing_page_creative', 'voiceover', 'animation', '3d_web_interactive',
            ]),
            brief: z.string().describe('what the content should say/show'),
            projectId: z.string().nullable().optional().describe('optional Project Registry project id to link this to'),
          }),
          execute: async (args) => {
            const { produceContentPiece } = await import('@/lib/content-studio');
            const { discoverCapabilityLive } = await import('@/lib/capability-discovery');
            const { chat } = await import('@/lib/connectors/llm');
            const kind = args.kind as any;
            const brief = typeof args.brief === 'string' ? args.brief : '';
            const projectId = typeof args.projectId === 'string' ? args.projectId : null;
            return produceContentPiece(
              getDb(),
              { kind, brief, projectId },
              { chat, discover: discoverCapabilityLive },
            );
          },
        },
        {
          name: 'listContentPieces',
          description: 'List every content piece ever produced or attempted, optionally filtered to a project.',
          parameters: z.object({ projectId: z.string().nullable().optional() }),
          execute: async (args) => {
            const projectId = typeof args.projectId === 'string' ? args.projectId : null;
            return projectId ? getDb().contentPieces.byProjectId(projectId) : getDb().contentPieces.all();
          },
        },
      ];
    },
  },
  // ── Idea Lab ──────────────────────────────────────────────────────────────
  {
    id: 'idea-lab-agent',
    name: 'Idea Lab',
    description: 'Scores new ideas on a transparent rubric — market size, ease-to-build, strategic fit.',
    departmentId: 'dept-idea-lab',
    async run() {
      const ideas = getDb().ideas.all();
      if (ideas.length === 0) return { ok: true, summary: 'No ideas registered yet — add one at /ideas.' };
      const scored = ideas.map((i) => ({ ...i, score: scoreIdea(i) })).sort((a, b) => b.score - a.score);
      const top = scored[0];
      return {
        ok: true,
        summary: `${ideas.length} idea${ideas.length === 1 ? '' : 's'} scored · top: "${top.title}" (${top.score.toFixed(2)}/5)`,
        data: scored,
      };
    },
  },

  // ── Usage & Cost Monitor ──────────────────────────────────────────────────
  {
    id: 'usage-cost-monitor',
    name: 'Usage & Cost Monitor',
    description: "Reads Anthropic's Admin API for model usage/cost. Requires a separate Admin API key.",
    departmentId: 'dept-tech',
    async run() {
      const status = await anthropicUsageStatus();
      return { ok: status.state === 'connected', summary: status.detail, data: status.meta };
    },
  },

  // ── Executive Reporter ────────────────────────────────────────────────────
  {
    id: 'executive-reporter',
    name: 'Executive Reporter',
    description: 'Turns raw agent_runs into a plain-language daily/weekly digest — no LLM required.',
    departmentId: 'dept-tech',
    async run() {
      const report = buildExecutiveReport(getDb(), { windowHours: 24 });
      queueNotification({
        kind: 'daily_report',
        agentId: 'executive-reporter',
        title: 'Daily digest',
        body: report.summary,
      });
      return { ok: report.failedRuns === 0, summary: report.summary, data: report };
    },
    async respond() {
      const report24 = buildExecutiveReport(getDb(), { windowHours: 24 });
      const report168 = buildExecutiveReport(getDb(), { windowHours: 168 });
      return {
        ok: true,
        summary: `Last 24h: ${report24.summary} · Last 7d: ${report168.summary}`,
        data: { day: report24, week: report168 },
      };
    },
  },
];
