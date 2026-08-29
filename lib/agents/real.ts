import { z } from 'zod';
import { getBrainProvider } from '@/lib/brain';
import { createGBrainProvider } from '@/lib/connectors/gbrain';
import { parseInboxConfigs, unreadCounts } from '@/lib/connectors/email';
import { configuredProcessors, stripeSnapshot } from '@/lib/connectors/payments';
import { recentMessages } from '@/lib/connectors/slack';
import { recentPages } from '@/lib/connectors/notion';
import { attioClients, attioStatus } from '@/lib/connectors/attio';
import { whatsappStatus } from '@/lib/connectors/whatsapp';
import { wisprStatus } from '@/lib/connectors/wispr';
import { localStackStatus } from '@/lib/connectors/local-stack';
import { aggregateStatus } from '@/lib/conductor';
import { ankaAdminStatus, fetchAnkaBranches, fetchAnkaSports } from '@/lib/connectors/anka-admin';
import { githubStatus } from '@/lib/connectors/github';
import { webSearchStatus } from '@/lib/connectors/web-search';
import { anthropicUsageStatus } from '@/lib/connectors/anthropic-usage';
import { calendarStatus } from '@/lib/connectors/gcal';
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

const label = (r: AgentRunResult) => (r.ok ? 'LIVE' : 'DOWN');

const envIntegrationRun =
  (name: string, envKey: string, purpose: string) =>
  async (): Promise<AgentRunResult> => {
    if (!process.env[envKey]) {
      return { ok: false, summary: `${name} not configured — set ${envKey} · ${purpose}` };
    }
    return { ok: true, summary: `${name} credential present · ${purpose}` };
  };

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
    description:
      'Chief of Staff / Conductor — the real cross-system view of what is blocked and waiting for a decision: pending lifecycle approvals, publish plans, outbound messages, capability candidates, and content stuck needing a capability. Every count is read live from the real repos, never invented or hardcoded to one project.',
    departmentId: 'dept-tech',
    async run() {
      const [stack, status] = await Promise.all([localStackStatus(), Promise.resolve(aggregateStatus(getDb()))]);
      return {
        ok: stack.state === 'connected',
        summary:
          status.totalBlockers === 0
            ? `All clear — nothing waiting on a decision. Instance hosts: ${stack.detail}`
            : `${status.totalBlockers} item(s) waiting on you: ${status.pendingLifecycleApprovals} lifecycle approval(s) · ${status.pendingPublishPlans} publish plan(s) · ${status.pendingOutboundMessages} outbound message(s) · ${status.candidateCapabilities} capability candidate(s) · ${status.blockedContentPieces} content piece(s) needing a capability`,
        data: { instanceHosts: stack.meta, status },
      };
    },
    chatTools(): LlmToolSpec[] {
      return [
        {
          name: 'getStatus',
          description:
            'Returns the real, live cross-system status: every pending approval and blocker across every domain (lifecycle, publishing, outbound comms, capabilities, content production). Use this before answering any "what needs my attention" question.',
          parameters: z.object({}),
          execute: async () => aggregateStatus(getDb()),
        },
        {
          name: 'listPendingLifecycleApprovals',
          description: 'Lists every lifecycle approval currently pending a decision, across all projects.',
          parameters: z.object({}),
          execute: async () => getDb().lifecycleApprovals.pending(),
        },
      ];
    },
  },

  // ── Comms instance + channel workers ─────────────────────────────────
  {
    id: 'comms-agent',
    name: 'Comms Agent',
    description: 'Aggregates the Gmail/WhatsApp/Slack workers that feed the unified /comms view. Can draft real replies, gated on explicit approval before anything is sent.',
    departmentId: 'dept-comms',
    async run() {
      const [gmail, whatsapp, slack] = await Promise.all([gmailRun(), whatsappRun(), slackRun()]);
      const live = [gmail, whatsapp, slack].filter((r) => r.ok).length;
      const pending = getDb().outboundMessages.pending().length;
      return {
        ok: live > 0,
        summary: `${live}/3 channels live → /comms · Gmail ${label(gmail)} · WhatsApp ${label(whatsapp)} · Slack ${label(slack)}${
          pending > 0 ? ` · ${pending} outbound message(s) awaiting approval` : ''
        }`,
        data: { gmail, whatsapp, slack, pendingOutbound: pending },
      };
    },
    chatTools(): LlmToolSpec[] {
      return [
        {
          name: 'draftReply',
          description:
            'Drafts a reply to a real email or WhatsApp contact. Always starts pending_approval — never sends on its own. Per the Approval Policy, a real message to a real person needs an explicit yes first.',
          parameters: z.object({
            channel: z.enum(['email', 'whatsapp']),
            to: z.string(),
            subject: z.string().nullable().optional(),
            body: z.string(),
          }),
          execute: async (args) => {
            const { draftOutboundMessage } = await import('@/lib/communications');
            const channel = args.channel === 'whatsapp' ? 'whatsapp' : 'email';
            const to = typeof args.to === 'string' ? args.to : '';
            const subject = typeof args.subject === 'string' ? args.subject : null;
            const body = typeof args.body === 'string' ? args.body : '';
            return draftOutboundMessage(getDb(), { channel, to, subject, body });
          },
        },
        {
          name: 'attemptSend',
          description:
            'Attempts to actually send an APPROVED outbound message via the real channel connector. Refuses anything not already approved. Reports the true outcome — never fakes success.',
          parameters: z.object({ messageId: z.string() }),
          execute: async (args) => {
            const { attemptSendLive } = await import('@/lib/communications');
            const messageId = typeof args.messageId === 'string' ? args.messageId : '';
            return attemptSendLive(getDb(), messageId);
          },
        },
        {
          name: 'listOutboundMessages',
          description: 'List every drafted outbound message, or only ones awaiting approval.',
          parameters: z.object({ onlyPending: z.boolean().nullable().optional() }),
          execute: async (args) => {
            return args.onlyPending ? getDb().outboundMessages.pending() : getDb().outboundMessages.all();
          },
        },
      ];
    },
  },
  { id: 'gmail-worker', name: 'Gmail Worker', description: 'Unread counts and recent mail from up to four IMAP inboxes.', departmentId: 'dept-comms', run: gmailRun },
  { id: 'whatsapp-worker', name: 'WhatsApp Worker', description: 'Local WhatsApp ChatStorage, read-only.', departmentId: 'dept-comms', run: whatsappRun },
  { id: 'slack-worker', name: 'Slack Worker', description: 'Latest messages across joined Slack channels.', departmentId: 'dept-comms', run: slackRun },

  // ── Studio instance + content workers ────────────────────────────────
  {
    id: 'social-agent',
    name: 'Social Agent',
    description: 'Legacy social/content pillar. Real production runs through Content Studio (social-content-studio, growth-marketing, social-publishing, ad-creative-research) — this instance now only carries the DM automation lane.',
    departmentId: 'dept-marketing-growth',
    async run() {
      const dmflow = await envIntegrationRun('DMFlow', 'MANYCHAT_API_KEY', 'DM automation and lead capture')();
      return {
        ok: dmflow.ok,
        summary: `DM automation lane: ${dmflow.summary} · real content production lives under Content Studio`,
        data: { dmflow },
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
    description: 'Legacy sales pillar. The named account lanes (Vantage, Launchpad Cohort) and the Ledger CRM connection were a prior operator\'s demo data, removed 2026-08-28 — reports processor health pending a real CRM connection.',
    departmentId: 'dept-sales',
    async run() {
      const processors = await processorConfirmationRun();
      return {
        ok: processors.ok,
        summary: `Sales pipeline · no CRM connected yet · processors ${label(processors)} · calls lane mapped`,
        data: { processors },
      };
    },
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
      "Dispatches real coding work to the `claude` CLI against the Project Registry's authorized targets, gated by each project's permissionLevel. Queuing a run (via the API or the project page panel) builds a real prompt with real project/stack/lifecycle context and costs nothing; a separate, explicit execute step is the only one that spends money. A full_with_approval-tier project's run queues as awaiting_approval and needs an explicit approve before it can run. Never pushes, force-pushes, or merges — that stays under the operator's explicit approval regardless of permission level.",
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
    chatTools(): LlmToolSpec[] {
      return [
        {
          name: 'dispatchCoding',
          description:
            "Queues a REAL coding task for the `claude` CLI against a Project Registry-authorized local project directory — this call itself is FREE and never spends money; it only builds a real prompt and creates a queued run. Refuses any project not both active and explicitly authorizing this agent. A full_with_approval-tier project's run queues as awaiting_approval, requiring a separate operator approval before it can run. Actually executing a queued run (the one paid step) is a deliberate separate action, never triggered automatically from this tool.",
          parameters: z.object({ projectId: z.string(), goal: z.string() }),
          execute: async (args) => {
            const projectId = typeof args.projectId === 'string' ? args.projectId : '';
            const goal = typeof args.goal === 'string' ? args.goal : '';
            const project = getDb().projects.byId(projectId);
            if (!project) return { ok: false, reason: 'project not found' };
            if (project.status !== 'active') return { ok: false, reason: `project is not active (status: ${project.status})` };
            if (!project.authorizedAgentIds.includes('claude-code-orchestrator')) {
              return { ok: false, reason: 'claude-code-orchestrator is not authorized on this project — grant access from /projects first' };
            }
            if (project.kind !== 'local') {
              return { ok: false, reason: 'only local projects can be dispatched to on this machine today' };
            }
            const { queueClaudeCodeRun } = await import('@/lib/claude-code-queue');
            const { buildDispatchPrompt } = await import('@/lib/claude-code-dispatch');
            const { detectProjectStack } = await import('@/lib/project-bootstrap');
            const { getOrCreateLifecycleState } = await import('@/lib/project-lifecycle-orchestrator');
            const stack = detectProjectStack(project.pathOrUrl);
            const lifecycle = getOrCreateLifecycleState(getDb(), project.id);
            const prompt = buildDispatchPrompt({ goal, stackNote: stack.note, lifecyclePhase: lifecycle.currentPhase });
            const run = queueClaudeCodeRun(getDb(), {
              projectId: project.id,
              projectDir: project.pathOrUrl,
              prompt,
              permissionLevel: project.permissionLevel,
            });
            return {
              ok: true,
              run,
              note:
                run.status === 'awaiting_approval'
                  ? 'Queued as awaiting_approval — this project requires an explicit operator approval before it can run.'
                  : 'Queued and free so far — a separate explicit execute step (from the project page) is required before any real, paid claude call is made.',
            };
          },
        },
      ];
    },
  },
  {
    id: 'qa-ui-review',
    name: 'QA & UI/UX Review',
    description:
      "Runs a Project Registry-authorized directory's own real npm test/typecheck/build scripts and parses the true output — never re-implements test logic, never reports ok without a real check having actually run.",
    departmentId: 'dept-product-eng',
    async run() {
      const authorized = getDb()
        .projects.all()
        .filter((p) => p.status === 'active' && p.authorizedAgentIds.includes('qa-ui-review'));
      return {
        ok: true,
        summary:
          authorized.length === 0
            ? 'No active project authorizes this agent yet — grant access from /projects, then use the runReview chat tool.'
            : `${authorized.length} project(s) authorized for QA review · use the runReview chat tool to run one.`,
        data: { authorized: authorized.map((p) => ({ id: p.id, name: p.name, pathOrUrl: p.pathOrUrl })) },
      };
    },
    chatTools(): LlmToolSpec[] {
      return [
        {
          name: 'runReview',
          description:
            'Runs the REAL test/typecheck/build commands for whatever stack the target project actually is (Node/npm, .NET/dotnet, or Python/pytest — auto-detected from real manifest files, never hardcoded) in a Project Registry-authorized project directory, and parses the true output. Refuses any project not both active and explicitly authorizing this agent. A missing script/toolchain is reported honestly as not_configured — never silently skipped as a pass.',
          parameters: z.object({ projectId: z.string() }),
          execute: async (args) => {
            const projectId = typeof args.projectId === 'string' ? args.projectId : '';
            const project = getDb().projects.byId(projectId);
            if (!project) return { ok: false, reason: 'project not found' };
            if (project.status !== 'active') return { ok: false, reason: `project is not active (status: ${project.status})` };
            if (!project.authorizedAgentIds.includes('qa-ui-review')) {
              return { ok: false, reason: 'qa-ui-review is not authorized on this project — grant access from /projects first' };
            }
            if (project.kind !== 'local') {
              return { ok: false, reason: 'only local projects can be reviewed on this machine today' };
            }
            const { runQaReviewLive } = await import('@/lib/qa-review-orchestrator');
            return runQaReviewLive(project.pathOrUrl);
          },
        },
      ];
    },
  },
  {
    id: 'security-reviewer',
    name: 'Security Reviewer',
    description:
      'Runs real npm audit, a regex secret scan, and code-pattern checks (wildcard CORS, SQL string concatenation, eval usage, unguarded dangerouslySetInnerHTML, hardcoded env fallbacks, mutating API routes with no visible auth check) against a Project Registry-authorized directory before release. Never reports a matched secret value or code snippet — findings are path + line + pattern name only — and never reports clean when a check could not actually run.',
    departmentId: 'dept-product-eng',
    async run() {
      const authorized = getDb()
        .projects.all()
        .filter((p) => p.status === 'active' && p.authorizedAgentIds.includes('security-reviewer'));
      return {
        ok: true,
        summary:
          authorized.length === 0
            ? 'No active project authorizes this agent yet — grant access from /projects, then use the runReview chat tool.'
            : `${authorized.length} project(s) authorized for security review · use the runReview chat tool to audit one.`,
        data: { authorized: authorized.map((p) => ({ id: p.id, name: p.name, pathOrUrl: p.pathOrUrl })) },
      };
    },
    chatTools(): LlmToolSpec[] {
      return [
        {
          name: 'runReview',
          description:
            'Runs a REAL npm audit + secret scan against a Project Registry-authorized project directory. Refuses any project not both active and explicitly authorizing this agent. Reports the true result — an unreadable audit is a fail, never reported clean, and a matched secret value is NEVER included in the output.',
          parameters: z.object({ projectId: z.string() }),
          execute: async (args) => {
            const projectId = typeof args.projectId === 'string' ? args.projectId : '';
            const project = getDb().projects.byId(projectId);
            if (!project) return { ok: false, reason: 'project not found' };
            if (project.status !== 'active') return { ok: false, reason: `project is not active (status: ${project.status})` };
            if (!project.authorizedAgentIds.includes('security-reviewer')) {
              return { ok: false, reason: 'security-reviewer is not authorized on this project — grant access from /projects first' };
            }
            if (project.kind !== 'local') {
              return { ok: false, reason: 'only local projects can be scanned on this machine today' };
            }
            const { runSecurityReview } = await import('@/lib/security-review-orchestrator');
            return runSecurityReview(project.pathOrUrl);
          },
        },
      ];
    },
  },
  {
    id: 'ui-ux-reviewer',
    name: 'UI/UX Reviewer',
    description:
      "Runs a real static accessibility scan (missing alt text, icon-only buttons with no aria-label, unlabeled form inputs, empty headings) against a Project Registry-authorized directory. Every finding carries severity, real matched-source evidence, and a concrete suggestion — never just a good/bad verdict. Separate from QA (test/build output) and Security Reviewer (audit/secrets) — this is presentation-layer quality. No live browser/Playwright run yet (see KI note): this is a real static pass, not a claim of pixel-level visual review.",
    departmentId: 'dept-product-eng',
    async run() {
      const authorized = getDb()
        .projects.all()
        .filter((p) => p.status === 'active' && p.authorizedAgentIds.includes('ui-ux-reviewer'));
      return {
        ok: true,
        summary:
          authorized.length === 0
            ? 'No active project authorizes this agent yet — grant access from /projects, then use the runReview chat tool.'
            : `${authorized.length} project(s) authorized for UI/UX review · use the runReview chat tool to scan one.`,
        data: { authorized: authorized.map((p) => ({ id: p.id, name: p.name, pathOrUrl: p.pathOrUrl })) },
      };
    },
    chatTools(): LlmToolSpec[] {
      return [
        {
          name: 'runReview',
          description:
            'Runs a REAL static accessibility scan against a Project Registry-authorized project directory (.tsx source only). Refuses any project not both active and explicitly authorizing this agent. Reports file + line for every real finding — never a vague summary.',
          parameters: z.object({ projectId: z.string() }),
          execute: async (args) => {
            const projectId = typeof args.projectId === 'string' ? args.projectId : '';
            const project = getDb().projects.byId(projectId);
            if (!project) return { ok: false, reason: 'project not found' };
            if (project.status !== 'active') return { ok: false, reason: `project is not active (status: ${project.status})` };
            if (!project.authorizedAgentIds.includes('ui-ux-reviewer')) {
              return { ok: false, reason: 'ui-ux-reviewer is not authorized on this project — grant access from /projects first' };
            }
            if (project.kind !== 'local') {
              return { ok: false, reason: 'only local projects can be scanned on this machine today' };
            }
            const { runUiUxReview } = await import('@/lib/ui-ux-review-orchestrator');
            return runUiUxReview(project.pathOrUrl);
          },
        },
      ];
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
        {
          name: 'compareCapabilityCandidates',
          description:
            "Ranks the top 3 candidates for a capability tag on cost/free-tier, credential requirement, and automation suitability (MCP server/CLI score higher than a hosted service needing manual clicks) — every score traces to a real Capability Registry field, never invented data. Use this after discoverCapability to present a real comparison instead of just a list.",
          parameters: z.object({ capability: z.string() }),
          execute: async (args) => {
            const capability = typeof args.capability === 'string' ? args.capability : '';
            const { compareCandidates } = await import('@/lib/capability-comparison');
            return compareCandidates(getDb().capabilities.byCapability(capability));
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
      'Produces the full content surface (posts, carousels, ad creative, product demo videos, motion content, images, mockups, landing-page creative, voiceover, animation, 3D/web interactive) — text-native kinds go straight through the LLM gateway; every media kind checks the Capability Registry for a real active tool first, runs live discovery if nothing is active yet, ranks discovered candidates via compareCandidates, and — only when the top pick needs real spend or a credential — queues a real approval_request naming what is needed, why, the options considered, and any free/no-credential alternative found. Never fakes media it did not actually produce, and never auto-activates a paid or credentialed tool.',
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

  // ── Growth & Marketing ──────────────────────────────────────────────────
  {
    id: 'growth-marketing',
    name: 'Growth & Marketing',
    description:
      'Researches target audience, positioning, competitors, channels, acquisition, SEO, campaigns, funnels, landing pages, and conversion for a real Project Registry project via live web search — never an invented opinion.',
    departmentId: 'dept-content-studio',
    async run() {
      const total = getDb().growthBriefs.all().length;
      return {
        ok: true,
        summary:
          total === 0
            ? 'No growth briefs yet — use the chat tool researchGrowth to run one.'
            : `${total} growth brief(s) on file.`,
        data: { total },
      };
    },
    chatTools(): LlmToolSpec[] {
      return [
        {
          name: 'researchGrowth',
          description:
            'Research one growth focus area (target_audience, positioning, competitor, channel, acquisition, seo, campaign, funnel, landing_page, conversion) for a real Project Registry project via live web search. Persists a brief with real sources; never invents findings.',
          parameters: z.object({
            projectId: z.string().describe('Project Registry project id this research is for'),
            focus: z.enum([
              'target_audience', 'positioning', 'competitor', 'channel', 'acquisition',
              'seo', 'campaign', 'funnel', 'landing_page', 'conversion',
            ]),
            query: z.string().describe('the web search query to run'),
          }),
          execute: async (args) => {
            const { runGrowthResearchLive } = await import('@/lib/growth-marketing');
            const projectId = typeof args.projectId === 'string' ? args.projectId : '';
            const focus = args.focus as any;
            const query = typeof args.query === 'string' ? args.query : '';
            return runGrowthResearchLive(getDb(), { projectId, focus, query });
          },
        },
        {
          name: 'listGrowthBriefs',
          description: 'List every growth brief for a project, optionally filtered to one focus area.',
          parameters: z.object({ projectId: z.string(), focus: z.string().nullable().optional() }),
          execute: async (args) => {
            const projectId = typeof args.projectId === 'string' ? args.projectId : '';
            const focus = typeof args.focus === 'string' ? args.focus : null;
            return focus ? getDb().growthBriefs.byFocus(projectId, focus) : getDb().growthBriefs.byProjectId(projectId);
          },
        },
      ];
    },
  },

  // ── Ad / Creative Research ───────────────────────────────────────────────
  {
    id: 'ad-creative-research',
    name: 'Ad / Creative Research',
    description:
      'Researches competitor ad creatives and current formats via live web search, then recommends which format fits a given platform/product type — producing a creative brief Social Content Studio can consume directly. Never invents a format recommendation without real sources.',
    departmentId: 'dept-content-studio',
    async run() {
      const total = getDb().creativeBriefs.all().length;
      return {
        ok: true,
        summary:
          total === 0
            ? 'No creative briefs yet — use the chat tool researchCreative to run one.'
            : `${total} creative brief(s) on file.`,
        data: { total },
      };
    },
    chatTools(): LlmToolSpec[] {
      return [
        {
          name: 'researchCreative',
          description:
            'Research competitor ad creatives and current formats for a real Project Registry project via live web search, and recommend one format (social_post, carousel, short_video, static_ad, landing_page, demo_video). Persists a brief with real sources; never invents a recommendation.',
          parameters: z.object({
            projectId: z.string().describe('Project Registry project id this research is for'),
            format: z.enum(['social_post', 'carousel', 'short_video', 'static_ad', 'landing_page', 'demo_video']),
            query: z.string().describe('the web search query to run'),
          }),
          execute: async (args) => {
            const { runCreativeResearchLive } = await import('@/lib/ad-creative-research');
            const projectId = typeof args.projectId === 'string' ? args.projectId : '';
            const format = args.format as any;
            const query = typeof args.query === 'string' ? args.query : '';
            return runCreativeResearchLive(getDb(), { projectId, format, query });
          },
        },
        {
          name: 'listCreativeBriefs',
          description: 'List every creative brief for a project.',
          parameters: z.object({ projectId: z.string() }),
          execute: async (args) => {
            const projectId = typeof args.projectId === 'string' ? args.projectId : '';
            return getDb().creativeBriefs.byProjectId(projectId);
          },
        },
      ];
    },
  },

  // ── Social Publishing ────────────────────────────────────────────────────
  {
    id: 'social-publishing',
    name: 'Social Publishing',
    description:
      'Plans which channels a Content Studio piece goes to and adapts the caption per platform. Never posts live without explicit operator approval, and never claims a post went out without a real channel connector confirming it.',
    departmentId: 'dept-content-studio',
    async run() {
      const pending = getDb().publishPlans.pending();
      const total = getDb().publishPlans.all().length;
      return {
        ok: true,
        summary:
          total === 0
            ? 'No publish plans yet — use the chat tool draftPublish to create one.'
            : `${total} publish plan(s) · ${pending.length} awaiting approval.`,
        data: { total, pending },
      };
    },
    chatTools(): LlmToolSpec[] {
      return [
        {
          name: 'draftPublish',
          description:
            'Draft a publish plan for a produced content piece: which platforms, and the per-platform adapted caption. Always starts pending_approval — never posts live on its own.',
          parameters: z.object({
            contentPieceId: z.string(),
            platforms: z.array(z.enum(['instagram', 'tiktok', 'twitter', 'youtube', 'linkedin'])).min(1),
            caption: z.string(),
            projectId: z.string().nullable().optional(),
          }),
          execute: async (args) => {
            const { draftPublishPlan } = await import('@/lib/social-publishing');
            const contentPieceId = typeof args.contentPieceId === 'string' ? args.contentPieceId : '';
            const platforms = Array.isArray(args.platforms) ? (args.platforms as any) : [];
            const caption = typeof args.caption === 'string' ? args.caption : '';
            const projectId = typeof args.projectId === 'string' ? args.projectId : null;
            return draftPublishPlan(getDb(), { contentPieceId, platforms, caption, projectId });
          },
        },
        {
          name: 'attemptPublish',
          description:
            'Attempt to actually publish an APPROVED plan via the real channel connector. Refuses anything not already approved. Reports the true outcome — never fakes success.',
          parameters: z.object({ planId: z.string() }),
          execute: async (args) => {
            const { attemptPublishLive } = await import('@/lib/social-publishing');
            const planId = typeof args.planId === 'string' ? args.planId : '';
            return attemptPublishLive(getDb(), planId);
          },
        },
        {
          name: 'listPublishPlans',
          description: 'List every publish plan, or only ones awaiting approval.',
          parameters: z.object({ onlyPending: z.boolean().nullable().optional() }),
          execute: async (args) => {
            return args.onlyPending ? getDb().publishPlans.pending() : getDb().publishPlans.all();
          },
        },
      ];
    },
  },

  // ── Work Assistant ───────────────────────────────────────────────────────
  {
    id: 'work-assistant',
    name: 'Work Assistant',
    description:
      "Alex's own task list — deliberately not tied to any Project Registry project or its lifecycle. Surfaces open tasks by priority and due date alongside the real upcoming calendar (CalDAV).",
    departmentId: 'dept-personal',
    async run() {
      const open = getDb().personalTasks.open();
      const calendar = await calendarStatus();
      return {
        ok: true,
        summary:
          open.length === 0
            ? `No open personal tasks · calendar: ${calendar.detail}`
            : `${open.length} open task(s), top: "${open[0].title}" (${open[0].priority}) · calendar: ${calendar.detail}`,
        data: { open, calendar },
      };
    },
    chatTools(): LlmToolSpec[] {
      return [
        {
          name: 'addTask',
          description: "Adds a task to Alex's personal task list. Never tied to a Project Registry project.",
          parameters: z.object({
            title: z.string(),
            dueAt: z.string().nullable().optional(),
            priority: z.enum(['low', 'normal', 'high']).nullable().optional(),
          }),
          execute: async (args) => {
            const title = typeof args.title === 'string' ? args.title : '';
            const dueAt = typeof args.dueAt === 'string' ? args.dueAt : null;
            const priority = args.priority === 'low' || args.priority === 'high' ? args.priority : 'normal';
            const task = {
              id: randomUUID(),
              title,
              dueAt,
              priority: priority as 'low' | 'normal' | 'high',
              status: 'open' as const,
              createdAt: new Date().toISOString(),
              completedAt: null,
            };
            getDb().personalTasks.insert(task);
            return task;
          },
        },
        {
          name: 'completeTask',
          description: 'Marks a personal task done. Only call this when explicitly told the task is done.',
          parameters: z.object({ taskId: z.string() }),
          execute: async (args) => {
            const taskId = typeof args.taskId === 'string' ? args.taskId : '';
            getDb().personalTasks.complete(taskId);
            return getDb().personalTasks.byId(taskId);
          },
        },
        {
          name: 'listTasks',
          description: 'Lists every personal task, or only the open ones.',
          parameters: z.object({ onlyOpen: z.boolean().nullable().optional() }),
          execute: async (args) => {
            return args.onlyOpen ? getDb().personalTasks.open() : getDb().personalTasks.all();
          },
        },
      ];
    },
  },

  // ── Personal Ops ─────────────────────────────────────────────────────────
  {
    id: 'personal-ops',
    name: 'Personal Ops',
    description:
      "Tracks Alex's recurring routines/habits (not one-off tasks, not a project) — daily/weekly/monthly cadence with an honest streak computed from an append-only completion log.",
    departmentId: 'dept-personal',
    async run() {
      const { currentStreak } = await import('@/lib/personal-ops');
      const db = getDb();
      const active = db.routines.active();
      const summaries = active.map((r) => {
        const completions = db.routineCompletions.forRoutine(r.id).map((c) => c.completedOn);
        const streak = currentStreak(completions, new Date().toISOString().slice(0, 10));
        return { ...r, streak };
      });
      return {
        ok: true,
        summary:
          summaries.length === 0
            ? 'No active routines yet — use the chat tool addRoutine to create one.'
            : summaries.map((r) => `${r.title}: ${r.streak}-day streak`).join(' · '),
        data: { routines: summaries },
      };
    },
    chatTools(): LlmToolSpec[] {
      return [
        {
          name: 'addRoutine',
          description: 'Adds a recurring routine/habit. Never a one-off task and never a Project Registry project.',
          parameters: z.object({
            title: z.string(),
            frequency: z.enum(['daily', 'weekdays', 'weekly', 'monthly']),
          }),
          execute: async (args) => {
            const title = typeof args.title === 'string' ? args.title : '';
            const frequency = args.frequency as 'daily' | 'weekdays' | 'weekly' | 'monthly';
            const routine = { id: randomUUID(), title, frequency, active: true, createdAt: new Date().toISOString() };
            getDb().routines.insert(routine);
            return routine;
          },
        },
        {
          name: 'checkIn',
          description:
            "Logs today's check-in for a routine. Append-only and idempotent — checking in twice on the same day never duplicates the streak entry.",
          parameters: z.object({ routineId: z.string() }),
          execute: async (args) => {
            const routineId = typeof args.routineId === 'string' ? args.routineId : '';
            const today = new Date().toISOString().slice(0, 10);
            getDb().routineCompletions.insert({ id: randomUUID(), routineId, completedOn: today, completedAt: new Date().toISOString() });
            const { currentStreak } = await import('@/lib/personal-ops');
            const completions = getDb().routineCompletions.forRoutine(routineId).map((c) => c.completedOn);
            return { routineId, completedOn: today, streak: currentStreak(completions, today) };
          },
        },
        {
          name: 'listRoutines',
          description: 'Lists every routine, or only the active ones, each with its current streak.',
          parameters: z.object({ onlyActive: z.boolean().nullable().optional() }),
          execute: async (args) => {
            const { currentStreak } = await import('@/lib/personal-ops');
            const db = getDb();
            const rows = args.onlyActive ? db.routines.active() : db.routines.all();
            const today = new Date().toISOString().slice(0, 10);
            return rows.map((r) => ({
              ...r,
              streak: currentStreak(db.routineCompletions.forRoutine(r.id).map((c) => c.completedOn), today),
            }));
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
    description:
      'Turns raw agent_runs into a plain-language daily/weekly digest — no LLM required. Also builds the real "overnight report" (completed/failed delegated tasks, pending lifecycle approvals, credential/approval-blocked capabilities, every project\'s lifecycle phase) via the overnightReport chat tool.',
    departmentId: 'dept-tech',
    async run() {
      const report = buildExecutiveReport(getDb(), { windowHours: 24 });
      queueNotification({
        kind: 'daily_report',
        agentId: 'executive-reporter',
        title: 'Daily digest',
        body: report.summary,
      });
      // Executive Reporter's own run succeeds if IT built the report.
      // report.failedRuns counts OTHER agents' failures over the window —
      // that is DATA the digest reports, not a verdict on this run. Tying
      // ok to it created a self-feeding loop: a genuinely successful
      // digest got recorded as 'failed' whenever anything else had a
      // blip, and that failure then counted against the NEXT run's own
      // failedRuns tally, forever, long after the real issue cleared.
      return { ok: true, summary: report.summary, data: report };
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
    chatTools(): LlmToolSpec[] {
      return [
        {
          name: 'overnightReport',
          description:
            'Builds the real overnight report: completed and failed delegated tasks, pending lifecycle approvals, capabilities awaiting credential/approval, and every project\'s current lifecycle phase — all from real DB rows, no invented commentary.',
          parameters: z.object({}),
          execute: async () => {
            const { buildOvernightReport } = await import('@/lib/agents/overnight-report');
            const report = buildOvernightReport(getDb());
            return { ok: true, markdown: report.toMarkdown(), report };
          },
        },
      ];
    },
  },
];
