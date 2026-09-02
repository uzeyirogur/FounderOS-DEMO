/**
 * Conductor routing. A message can name its target explicitly with a leading
 * `@<agentId|name>`; otherwise the model picks the best-fit agent from the
 * roster. Either way the Conductor delegates to that agent's chat (with its
 * tools) and returns `{ routedTo, ...chat }`. Routing never throws on a bad
 * `@name` — it falls back to model routing.
 */
import { chat as llmChat } from '@/lib/connectors/llm';
import { chatWithAgent, type ChatResult } from '@/lib/agents/chat';
import type { FounderDb } from '@/lib/db';
import type { RuntimeAgent } from '@/lib/agents/runtime';
import { openDb } from '@/lib/db';
import { productionAgents as realAgents } from './real';
import { randomUUID } from 'crypto';

export type ConductorResult = ChatResult & { routedTo: string };

/** Result type for Telegram gateway integration */
export interface TelegramRouteResult {
  type: 'agent_dispatch' | 'direct_response' | 'clarification_needed';
  agentId?: string;
  projectId?: string;
  taskId?: string;
  approvalId?: string;
  taskCreated?: boolean;
  projectCreated?: boolean;
  requiresApproval?: boolean;
  immediateResult?: string;
  response?: string;
  question?: string;
}

const AT_PREFIX = /^@(\S+)\s*/;

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function matchAgent(agents: RuntimeAgent[], token: string): RuntimeAgent | undefined {
  const t = slug(token);
  return agents.find((a) => a.id === token || a.id === t || slug(a.name) === t);
}

/** Keyword-based agent matching — FALLBACK ONLY when LLM fails */
function matchAgentByKeywords(routable: RuntimeAgent[], message: string): string | undefined {
  const lower = message.toLowerCase();
  
  if (/araştır|research|analiz|incel|karşılaştır|compare/i.test(lower)) {
    const research = routable.find(a => a.id.includes('research') || a.name.toLowerCase().includes('araştır'));
    if (research) return research.id;
  }
  if (/sosyal|social|linkedin|twitter|instagram|tiktok|post|paylaş/i.test(lower)) {
    const social = routable.find(a => a.id.includes('social') || a.name.toLowerCase().includes('sosyal'));
    if (social) return social.id;
  }
  if (/kod|code|geliştir|develop|implement|bug|fix|backend|frontend/i.test(lower)) {
    const code = routable.find(a => a.id.includes('code') || a.id.includes('claude-code'));
    if (code) return code.id;
  }
  if (/pazarlama|marketing|growth|reklam|ad|kampanya|campaign/i.test(lower)) {
    const growth = routable.find(a => a.id.includes('growth') || a.id.includes('marketing'));
    if (growth) return growth.id;
  }
  if (/satış|sales|crm|müşteri|customer|lead/i.test(lower)) {
    const sales = routable.find(a => a.id.includes('sales') || a.id.includes('crm'));
    if (sales) return sales.id;
  }
  if (/email|mail|slack|mesaj|message|iletişim/i.test(lower)) {
    const comms = routable.find(a => a.id.includes('comms') || a.name.toLowerCase().includes('comms'));
    if (comms) return comms.id;
  }
  
  return undefined;
}

/** Retry helper with exponential backoff */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelayMs: number = 1000,
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isRateLimit = lastError.message.includes('rate-limit') || 
                          lastError.message.includes('429') ||
                          lastError.message.includes('too many requests');
      
      if (attempt < maxAttempts && isRateLimit) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1); // 1s, 2s, 4s
        console.log(`[Conductor] Rate limited, retry ${attempt}/${maxAttempts} in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw lastError;
      }
    }
  }
  throw lastError;
}

/** Ask the model for the single best-fit agent id. LLM-first, keyword fallback. */
async function pickAgent(routable: RuntimeAgent[], message: string): Promise<string> {
  // PRIMARY: LLM routing with retry
  try {
    const roster = routable.map((a) => `- ${a.id}: ${a.name} — ${a.description}`).join('\n');
    const system = [
      'You are the Conductor, the router for Founder OS operator agents.',
      'Pick the single best-fit agent for the user message.',
      'Reply with ONLY that agent id and nothing else. Options:',
      roster,
    ].join('\n');
    
    const res = await withRetry(
      () => llmChat({ system, messages: [{ role: 'user', content: message }] }),
      3,  // max attempts
      1000 // base delay
    );
    
    const picked = (res.text.trim().split(/\s+/)[0] ?? '').replace(/[^a-zA-Z0-9_-]/g, '');
    const found = routable.find((a) => a.id === picked);
    if (found) return found.id;
  } catch (error) {
    // LLM failed after retries — fall through to keyword matching
    console.warn('[Conductor] LLM routing failed after retries:', error instanceof Error ? error.message : error);
  }
  
  // FALLBACK: Keyword-based routing
  const keywordMatch = matchAgentByKeywords(routable, message);
  if (keywordMatch) {
    console.log('[Conductor] Using keyword fallback:', keywordMatch);
    return keywordMatch;
  }
  
  // FINAL FALLBACK: First agent
  console.log('[Conductor] Using first agent fallback:', routable[0].id);
  return routable[0].id;
}

export async function routeConductorMessage(
  db: FounderDb,
  agents: RuntimeAgent[],
  message: string,
  opts: { screenContext?: string } = {},
): Promise<ConductorResult> {
  const routable = agents.filter((a) => a.id !== 'conductor');
  let targetId: string | undefined;
  let delivered = message;

  const at = message.match(AT_PREFIX);
  if (at) {
    const explicit = matchAgent(routable, at[1]);
    if (explicit) {
      targetId = explicit.id;
      delivered = message.replace(AT_PREFIX, '').trim() || message;
    }
    // unknown @name → fall through to model routing (never throw)
  }

  if (!targetId) targetId = await pickAgent(routable, message);

  const result = await chatWithAgent(db, agents, targetId, delivered, opts);
  return { routedTo: targetId, ...result };
}

// ── Telegram Gateway Integration ────────────────────────────────────────────

/**
 * Route a message from Telegram to the appropriate agent.
 * Creates proper DB records (tasks, projects) and returns structured result.
 */
export async function routeMessage(
  goal: string,
  context: {
    source: 'telegram';
    sourceId: string;
    chatId: number;
    userId: number;
  },
): Promise<TelegramRouteResult> {
  const db = openDb(process.env.FOUNDER_OS_DB || ':memory:');
  const routable = realAgents.filter((a: RuntimeAgent) => a.id !== 'conductor');
  
  // Check if this is a simple query or a task that needs tracking
  const isSimpleQuery = /^(durum|ne|nasıl|hangi|kaç|listele|göster)/i.test(goal.trim()) ||
    goal.length < 30;
  
  // Pick agent
  let targetId: string | undefined;
  let delivered = goal;
  
  const at = goal.match(AT_PREFIX);
  if (at) {
    const explicit = matchAgent(routable, at[1]);
    if (explicit) {
      targetId = explicit.id;
      delivered = goal.replace(AT_PREFIX, '').trim() || goal;
    }
  }
  
  if (!targetId) {
    targetId = await pickAgent(routable, goal);
  }
  
  // For simple queries, just route and return
  if (isSimpleQuery) {
    try {
      const result = await chatWithAgent(db, realAgents, targetId!, delivered, {});
      return {
        type: 'agent_dispatch',
        agentId: targetId,
        immediateResult: result.reply,
      };
    } catch (error) {
      return {
        type: 'direct_response',
        response: `Hata: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  
  // For complex tasks, create a lifecycle task
  const taskId = randomUUID();
  const now = new Date().toISOString();
  
  // Check if this might need a project
  const needsProject = /proje|oluştur|başlat|kur|geliştir|implement/i.test(goal);
  let projectId: string | undefined;
  let projectCreated = false;
  
  if (needsProject) {
    // Check if user mentioned an existing project
    const projects = db.projects.all();
    const mentionedProject = projects.find((p: { name: string }) => 
      goal.toLowerCase().includes(p.name.toLowerCase())
    );
    
    if (mentionedProject) {
      projectId = mentionedProject.id;
    } else {
      // Create a new project
      projectId = randomUUID();
      const projectName = goal.split(/[,.]/).filter((s: string) => s.length > 10)[0]?.trim().slice(0, 50) || 
        `Telegram Task ${new Date().toLocaleDateString('tr-TR')}`;
      
      db.projects.insert({
        id: projectId,
        name: projectName,
        status: 'active',
        kind: 'local',
        createdAt: now,
        updatedAt: now,
        origin: 'os',
        pathOrUrl: 'telegram://command',  // Telegram-originated project
        purpose: goal.slice(0, 200),
        permissionLevel: 'full_with_approval',
        authorizedAgentIds: [targetId!],
      });
      projectCreated = true;
    }
  }
  
  // Create lifecycle task
  db.lifecycleTasks.insert({
    id: taskId,
    projectId: projectId || 'telegram-tasks',  // Default project for non-project tasks
    phase: 'implementation',  // Use valid phase
    title: goal.slice(0, 100),
    responsibleAgentId: targetId!,
    status: 'open',
    blockedReason: null,
    createdAt: now,
    updatedAt: now,
  });
  
  // Check if this needs approval
  const needsApproval = /onay|onayla|izin|yayınla|deploy|push|commit|harca|öde|satın/i.test(goal);
  let approvalId: string | undefined;
  
  if (needsApproval) {
    approvalId = randomUUID();
    db.lifecycleApprovals.insert({
      id: approvalId,
      projectId: projectId || 'telegram-tasks',
      phase: 'implementation',
      title: goal.slice(0, 100),
      description: `Telegram'dan gelen talimat: ${goal}`,
      requestedByAgentId: targetId!,
      status: 'pending',
      createdAt: now,
      decidedAt: null,
      decidedBy: null,
      notes: null,
    });
  }
  
  // Now actually run the agent
  try {
    const result = await chatWithAgent(db, realAgents, targetId!, delivered, {});
    
    // Update task status
    db.lifecycleTasks.updateStatus(taskId, needsApproval ? 'blocked' : 'done', null);
    
    return {
      type: 'agent_dispatch',
      agentId: targetId,
      projectId,
      taskId,
      approvalId,
      taskCreated: true,
      projectCreated,
      requiresApproval: needsApproval,
      immediateResult: result.reply,
    };
  } catch (error) {
    db.lifecycleTasks.updateStatus(taskId, 'blocked', 'Görev başarısız');
    
    return {
      type: 'agent_dispatch',
      agentId: targetId,
      projectId,
      taskId,
      taskCreated: true,
      projectCreated,
      immediateResult: `Görev başarısız: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
