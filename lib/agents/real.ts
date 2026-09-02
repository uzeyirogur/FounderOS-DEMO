import { z } from 'zod';
import { getBrainProvider } from '@/lib/brain';
import { createGBrainProvider } from '@/lib/connectors/gbrain';
import { webSearchStatus } from '@/lib/connectors/web-search';
import { aggregateStatus } from '@/lib/conductor';
import { localStackStatus } from '@/lib/connectors/local-stack';
import { detectProjectStack } from '@/lib/project-bootstrap';
import { getDb } from '@/lib/data';
import { randomUUID } from 'node:crypto';
import type { LlmToolSpec } from '@/lib/connectors/llm';
import type { AgentRunResult, RuntimeAgent } from '@/lib/agents/runtime';

/**
 * Queues a notification for delivery.
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
 * The REAL agent roster — only production agents, no demo/boilerplate.
 * 8 core agents for FounderOS operations.
 */
export const realAgents: RuntimeAgent[] = [
  // ── 1. CONDUCTOR — Orkestratör ──────────────────────────────────────────
  {
    id: 'conductor',
    name: 'Conductor',
    description:
      'Chief of Staff — cross-system view of pending approvals, blocked tasks, and lifecycle decisions. Routes incoming requests to the right agent.',
    departmentId: 'dept-command',
    async run() {
      const [stack, status] = await Promise.all([localStackStatus(), Promise.resolve(aggregateStatus(getDb()))]);
      return {
        ok: true,
        summary:
          status.totalBlockers === 0
            ? `All clear — nothing waiting on a decision.`
            : `${status.totalBlockers} item(s) waiting: ${status.pendingLifecycleApprovals} approval(s) · ${status.pendingPublishPlans} publish plan(s) · ${status.pendingOutboundMessages} outbound message(s)`,
        data: { instanceHosts: stack.meta, status },
      };
    },
    chatTools(): LlmToolSpec[] {
      return [
        {
          name: 'getStatus',
          description: 'Returns the real, live cross-system status: pending approvals and blockers.',
          parameters: z.object({}),
          execute: async () => aggregateStatus(getDb()),
        },
        {
          name: 'listPendingApprovals',
          description: 'Lists every lifecycle approval currently pending a decision.',
          parameters: z.object({}),
          execute: async () => getDb().lifecycleApprovals.pending(),
        },
      ];
    },
  },

  // ── 2. DATA AGENT — Veri/Arama ───────────────────────────────────────────
  {
    id: 'data-agent',
    name: 'Data Agent',
    description: 'Analyzes storage health and answers queries by searching the knowledge base.',
    departmentId: 'dept-tech',
    async run() {
      const overview = await createGBrainProvider().overview();
      const { store, doctor } = overview;
      return {
        ok: doctor.connected,
        summary: `${doctor.detail} · ${store.totalFiles} md pages`,
        data: { overview },
      };
    },
    async respond(message: string) {
      const results = await getBrainProvider().search(message);
      if (results.length === 0) {
        return { ok: false, summary: `Nothing matches "${message.slice(0, 80)}"` };
      }
      return {
        ok: true,
        summary: results.slice(0, 3).map((r) => `${r.title}: ${r.snippet.slice(0, 100)}`).join(' · '),
        data: results,
      };
    },
    chatTools(): LlmToolSpec[] {
      return [
        {
          name: 'searchKnowledgeBase',
          description: 'Search the knowledge base and return matching notes.',
          parameters: z.object({ query: z.string().describe('what to look up') }),
          execute: async (args) => {
            const query = typeof args.query === 'string' ? args.query : '';
            const results = await getBrainProvider().search(query);
            return results.slice(0, 5);
          },
        },
      ];
    },
  },

  // ── 3. RESEARCH AGENT — Araştırma ────────────────────────────────────────
  {
    id: 'product-competitor-research',
    name: 'Research Agent',
    description: 'Web research via Brave Search for competitor analysis, market research, and discovery.',
    departmentId: 'dept-research',
    async run() {
      const status = await webSearchStatus();
      return { ok: status.state === 'connected', summary: status.detail, data: status.meta };
    },
    chatTools(): LlmToolSpec[] {
      return [
        {
          name: 'searchWeb',
          description: 'Search the web via Brave Search for research.',
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

  // ── 4. CODE ORCHESTRATOR — Kod ───────────────────────────────────────────
  {
    id: 'claude-code-orchestrator',
    name: 'Code Agent',
    description: 'Dispatches coding work to Claude CLI against authorized projects.',
    departmentId: 'dept-engineering',
    async run() {
      const projects = getDb().projects.all();
      const active = projects.filter((p) => p.status === 'active');
      const authorized = active.filter((p) => p.authorizedAgentIds.includes('claude-code-orchestrator'));
      return {
        ok: true,
        summary: `${authorized.length}/${active.length} active projects authorized for coding.`,
        data: { active: active.length, authorized: authorized.length },
      };
    },
    chatTools(): LlmToolSpec[] {
      return [
        {
          name: 'dispatchCoding',
          description: 'Queue a coding task for Claude CLI on a registered project.',
          parameters: z.object({ projectId: z.string(), goal: z.string() }),
          execute: async (args) => {
            const projectId = typeof args.projectId === 'string' ? args.projectId : '';
            const goal = typeof args.goal === 'string' ? args.goal : '';
            const project = getDb().projects.byId(projectId);
            if (!project) return { ok: false, reason: 'project not found' };
            if (project.status !== 'active') return { ok: false, reason: 'project not active' };
            if (!project.authorizedAgentIds.includes('claude-code-orchestrator')) {
              return { ok: false, reason: 'agent not authorized on this project' };
            }
            const { queueClaudeCodeRun } = await import('@/lib/claude-code-queue');
            const { buildDispatchPrompt } = await import('@/lib/claude-code-dispatch');
            const stack = detectProjectStack(project.pathOrUrl);
            const prompt = buildDispatchPrompt({ goal, stackNote: stack.note, lifecyclePhase: 'implementation' });
            const run = queueClaudeCodeRun(getDb(), {
              projectId: project.id,
              projectDir: project.pathOrUrl,
              prompt,
              permissionLevel: project.permissionLevel,
            });
            return { ok: true, run };
          },
        },
      ];
    },
  },

  // ── 5. PROJECT BOOTSTRAP — Proje ─────────────────────────────────────────
  {
    id: 'project-bootstrap',
    name: 'Project Agent',
    description: 'Detects project stack from manifest files and creates new projects.',
    departmentId: 'dept-engineering',
    async run() {
      const projects = getDb().projects.all().filter((p) => p.kind === 'local');
      if (projects.length === 0) {
        return { ok: false, summary: 'No local projects registered yet.' };
      }
      const reports = projects.map((p) => ({ id: p.id, name: p.name, stack: detectProjectStack(p.pathOrUrl) }));
      return {
        ok: true,
        summary: `${reports.length} local project(s): ${reports.map((r) => r.name).join(', ')}`,
        data: reports,
      };
    },
  },

  // ── 6. CONTENT STUDIO — İçerik ───────────────────────────────────────────
  {
    id: 'social-content-studio',
    name: 'Content Agent',
    description: 'Produces content: posts, carousels, ad creative, landing pages, copy.',
    departmentId: 'dept-content',
    async run() {
      const db = getDb();
      const total = db.contentPieces.all().length;
      return {
        ok: true,
        summary: total === 0 ? 'No content pieces yet.' : `${total} content piece(s) tracked.`,
        data: { total },
      };
    },
    chatTools(): LlmToolSpec[] {
      return [
        {
          name: 'produceContent',
          description: 'Produce a piece of content from a brief.',
          parameters: z.object({
            kind: z.enum(['social_post', 'carousel', 'ad_creative', 'landing_page', 'copy']),
            brief: z.string().describe('what the content should say/show'),
            projectId: z.string().nullable().optional(),
          }),
          execute: async (args) => {
            const { produceContentPiece } = await import('@/lib/content-studio');
            const { discoverCapabilityLive } = await import('@/lib/capability-discovery');
            const { chat } = await import('@/lib/connectors/llm');
            return produceContentPiece(
              getDb(),
              { kind: args.kind as any, brief: args.brief as string, projectId: args.projectId as string | null },
              { chat, discover: discoverCapabilityLive },
            );
          },
        },
      ];
    },
  },

  // ── 7. GROWTH & MARKETING — Pazarlama ────────────────────────────────────
  {
    id: 'growth-marketing',
    name: 'Marketing Agent',
    description: 'Researches audience, positioning, competitors, channels, SEO, campaigns.',
    departmentId: 'dept-marketing',
    async run() {
      const total = getDb().growthBriefs.all().length;
      return {
        ok: true,
        summary: total === 0 ? 'No growth briefs yet.' : `${total} growth brief(s) on file.`,
        data: { total },
      };
    },
    chatTools(): LlmToolSpec[] {
      return [
        {
          name: 'researchGrowth',
          description: 'Research a growth focus area via live web search.',
          parameters: z.object({
            projectId: z.string(),
            focus: z.enum(['target_audience', 'positioning', 'competitor', 'channel', 'seo', 'campaign']),
            query: z.string(),
          }),
          execute: async (args) => {
            const { runGrowthResearchLive } = await import('@/lib/growth-marketing');
            return runGrowthResearchLive(getDb(), {
              projectId: args.projectId as string,
              focus: args.focus as any,
              query: args.query as string,
            });
          },
        },
      ];
    },
  },

  // ── 8. AD CREATIVE — Reklam ──────────────────────────────────────────────
  {
    id: 'ad-creative-research',
    name: 'Ad Creative Agent',
    description: 'Researches competitor ads and recommends formats for campaigns.',
    departmentId: 'dept-marketing',
    async run() {
      const total = getDb().creativeBriefs.all().length;
      return {
        ok: true,
        summary: total === 0 ? 'No creative briefs yet.' : `${total} creative brief(s) on file.`,
        data: { total },
      };
    },
    chatTools(): LlmToolSpec[] {
      return [
        {
          name: 'researchCreative',
          description: 'Research competitor ad creatives and recommend a format.',
          parameters: z.object({
            projectId: z.string(),
            format: z.enum(['social_post', 'carousel', 'short_video', 'static_ad', 'landing_page']),
            query: z.string(),
          }),
          execute: async (args) => {
            const { runCreativeResearchLive } = await import('@/lib/ad-creative-research');
            return runCreativeResearchLive(getDb(), {
              projectId: args.projectId as string,
              format: args.format as any,
              query: args.query as string,
            });
          },
        },
      ];
    },
  },
];
