/**
 * Telegram → FounderOS Gateway
 * 
 * Production-safe orchestration between Telegram and FounderOS Conductor.
 * 
 * Features:
 * - Idempotency: duplicate update_id detection
 * - Authorization: whitelist-based user control
 * - Rate limiting: per-user throttle
 * - Audit logging: every command → DB
 * - Task/Project correlation
 * - Approval flow support
 * - Error handling with retry semantics
 */

import { openDb, type FounderDb } from './db';
import { sendTelegramMessage } from './connectors/telegram';
import { randomUUID } from 'crypto';
import type { TelegramCommand, TelegramAuthorizedUser } from './schemas';
import { productionAgents as realAgents } from './agents/real';

// ── Types ───────────────────────────────────────────────────────────────────

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    date: number;
    text?: string;
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    message?: {
      chat: { id: number };
    };
    data?: string;
  };
}

export interface GatewayResult {
  success: boolean;
  commandId?: string;
  status: 'duplicate' | 'unauthorized' | 'rate_limited' | 'processed' | 'error';
  message?: string;
  responseText?: string;
}

// ── Rate Limiting ───────────────────────────────────────────────────────────

const rateLimitMap = new Map<number, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20;  // 20 requests per minute per user

function checkRateLimit(userId: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  entry.count++;
  return true;
}

// ── Authorization ───────────────────────────────────────────────────────────

interface AuthCheck {
  authorized: boolean;
  role?: 'owner' | 'operator' | 'viewer';
  reason?: string;
}

function checkAuthorization(db: FounderDb, userId: number): AuthCheck {
  // SECURITY: Explicit allowlist only — no auto-authorization
  // Add users via: db.telegramAuthorizedUsers.add(userId, userName, 'owner', 'system')
  // Or via environment: TELEGRAM_OWNER_USER_ID
  
  // Check environment-based owner first
  const envOwnerId = process.env.TELEGRAM_OWNER_USER_ID;
  if (envOwnerId && String(userId) === envOwnerId) {
    return { authorized: true, role: 'owner', reason: 'env_owner' };
  }
  
  const role = db.telegramAuthorizedUsers.getRole(userId);
  if (!role) {
    return { authorized: false, reason: 'not_in_whitelist' };
  }
  
  return { authorized: true, role: role as 'owner' | 'operator' | 'viewer' };
}

// ── Command Parsing ─────────────────────────────────────────────────────────

interface ParsedCommand {
  type: 'system' | 'approval_response' | 'conductor_task';
  systemCommand?: 'start' | 'durum' | 'yardim' | 'projeler' | 'komutlar' | 'gecmis';
  approvalData?: { approvalId: string; decision: 'approved' | 'rejected' };
  conductorGoal?: string;
}

function parseCommand(text: string, callbackData?: string): ParsedCommand {
  // Callback query for approval buttons
  if (callbackData) {
    const [action, approvalId] = callbackData.split(':');
    if ((action === 'approve' || action === 'reject') && approvalId) {
      return {
        type: 'approval_response',
        approvalData: { approvalId, decision: action === 'approve' ? 'approved' : 'rejected' },
      };
    }
  }
  
  const trimmed = text.trim().toLowerCase();
  
  // System commands
  if (trimmed === '/start') return { type: 'system', systemCommand: 'start' };
  if (trimmed === '/durum' || trimmed === '/status') return { type: 'system', systemCommand: 'durum' };
  if (trimmed === '/yardim' || trimmed === '/help') return { type: 'system', systemCommand: 'yardim' };
  if (trimmed === '/projeler' || trimmed === '/projects') return { type: 'system', systemCommand: 'projeler' };
  if (trimmed === '/komutlar' || trimmed === '/commands') return { type: 'system', systemCommand: 'komutlar' };
  if (trimmed === '/gecmis' || trimmed === '/history') return { type: 'system', systemCommand: 'gecmis' };
  
  // Everything else → Conductor task
  return { type: 'conductor_task', conductorGoal: text.trim() };
}

// ── System Command Handlers ─────────────────────────────────────────────────

async function handleSystemCommand(
  db: FounderDb,
  command: 'start' | 'durum' | 'yardim' | 'projeler' | 'komutlar' | 'gecmis',
  chatId: number,
  userName: string,
): Promise<string> {
  switch (command) {
    case 'start':
      return `🚀 *FounderOS Komuta Merkezi*

Merhaba ${userName}! Sistem aktif.

Bu bot üzerinden:
• Doğal dilde talimat verebilirsin
• Proje durumlarını sorgulayabilirsin
• Onay bekleyen işleri yönetebilirsin

/yardim yazarak komutları görebilirsin.`;

    case 'durum': {
      const projects = db.projects.all().slice(0, 5);
      const pendingApprovals = db.lifecycleApprovals.pending().slice(0, 3);
      const recentCommands = db.telegramCommands.recent(3);
      
      let status = `📊 *Sistem Durumu*\n\n`;
      status += `📁 *Projeler:* ${db.projects.all().length}\n`;
      status += `⏳ *Bekleyen Onay:* ${pendingApprovals.length}\n`;
      status += `🤖 *Aktif Ajan:* ${realAgents.length}\n`;
      status += `📨 *Son Komut:* ${recentCommands.length > 0 ? recentCommands[0].messageText.slice(0, 30) + '...' : 'Yok'}\n\n`;
      
      if (pendingApprovals.length > 0) {
        status += `🔔 *Onay Bekleyenler:*\n`;
        pendingApprovals.forEach((a: { title: string }) => {
          status += `• ${a.title}\n`;
        });
      }
      
      return status;
    }

    case 'yardim':
      return `📖 *Komutlar*

*Sistem:*
/durum - Genel durum özeti
/projeler - Proje listesi
/komutlar - Son gönderilen komutlar
/gecmis - İşlem geçmişi

*Talimat Verme:*
Doğrudan yaz, Conductor yönlendirecek:
"Yeni SaaS fikirleri araştır"
"TIVARO projesinin durumu ne?"
"Video üretim araçlarını karşılaştır"

*Onay:*
Onay isteği geldiğinde butonlarla cevapla.`;

    case 'projeler': {
      const projects = db.projects.all();
      if (projects.length === 0) {
        return `📁 *Projeler*\n\nHenüz proje yok.`;
      }
      let msg = `📁 *Projeler* (${projects.length})\n\n`;
      projects.slice(0, 10).forEach((p: { name: string; status: string; createdAt: string }, i: number) => {
        msg += `${i + 1}. *${p.name}*\n   ${p.status} • ${p.createdAt.split('T')[0]}\n`;
      });
      if (projects.length > 10) {
        msg += `\n... ve ${projects.length - 10} proje daha`;
      }
      return msg;
    }

    case 'komutlar': {
      const cmds = db.telegramCommands.byChatId(chatId, 10);
      if (cmds.length === 0) {
        return `📨 *Son Komutlar*\n\nHenüz komut yok.`;
      }
      let msg = `📨 *Son Komutlar*\n\n`;
      cmds.forEach((c: TelegramCommand) => {
        const statusEmoji = c.status === 'completed' ? '✅' : c.status === 'failed' ? '❌' : '⏳';
        msg += `${statusEmoji} ${c.messageText.slice(0, 40)}${c.messageText.length > 40 ? '...' : ''}\n`;
      });
      return msg;
    }

    case 'gecmis': {
      const cmds = db.telegramCommands.recent(15);
      if (cmds.length === 0) {
        return `📜 *İşlem Geçmişi*\n\nHenüz işlem yok.`;
      }
      let msg = `📜 *İşlem Geçmişi*\n\n`;
      cmds.forEach((c: TelegramCommand) => {
        const date = c.createdAt.split('T')[0];
        const statusEmoji = c.status === 'completed' ? '✅' : c.status === 'failed' ? '❌' : c.status === 'awaiting_approval' ? '🔔' : '⏳';
        msg += `${statusEmoji} [${date}] ${c.messageText.slice(0, 35)}...\n`;
      });
      return msg;
    }
  }
}

// ── Conductor Integration ───────────────────────────────────────────────────

async function routeToConductor(
  db: FounderDb,
  commandId: string,
  goal: string,
  chatId: number,
  userId: number,
): Promise<{ success: boolean; responseText: string; agentId?: string; projectId?: string; taskId?: string; approvalId?: string }> {
  // Import conductor at runtime to avoid circular deps
  const { routeMessage } = await import('./agents/conductor');
  
  try {
    // Let conductor decide which agent(s) to invoke
    const result = await routeMessage(goal, {
      source: 'telegram',
      sourceId: commandId,
      chatId,
      userId,
    });
    
    // Build response based on what conductor did
    let responseText = '';
    
    if (result.type === 'agent_dispatch') {
      const agent = realAgents.find((a: { id: string }) => a.id === result.agentId);
      responseText = `🤖 *${agent?.name || result.agentId}* göreve atandı.\n\n`;
      
      if (result.taskCreated) {
        responseText += `📋 Görev oluşturuldu: \`${result.taskId?.slice(0, 8)}\`\n`;
      }
      if (result.projectCreated) {
        responseText += `📁 Proje oluşturuldu: \`${result.projectId?.slice(0, 8)}\`\n`;
      }
      if (result.requiresApproval) {
        responseText += `\n⏳ Bu işlem onay gerektiriyor. Onay isteği gelecek.`;
      }
      if (result.immediateResult) {
        responseText += `\n${result.immediateResult}`;
      }
    } else if (result.type === 'direct_response') {
      responseText = result.response || 'İşlem tamamlandı.';
    } else if (result.type === 'clarification_needed') {
      responseText = `❓ *Açıklama Gerekiyor*\n\n${result.question}`;
    }
    
    return {
      success: true,
      responseText,
      agentId: result.agentId,
      projectId: result.projectId,
      taskId: result.taskId,
      approvalId: result.approvalId,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      responseText: `❌ *Hata*\n\nTalimat işlenirken sorun oluştu:\n\`${errMsg.slice(0, 200)}\``,
    };
  }
}

// ── Approval Handler ────────────────────────────────────────────────────────

async function handleApprovalResponse(
  db: FounderDb,
  approvalId: string,
  decision: 'approved' | 'rejected',
  userId: number,
): Promise<string> {
  const approval = db.lifecycleApprovals.byId(approvalId);
  
  if (!approval) {
    return `❌ Onay bulunamadı: \`${approvalId}\``;
  }
  
  if (approval.status !== 'pending') {
    return `⚠️ Bu onay zaten işlenmiş: ${approval.status}`;
  }
  
  // Check user has approval rights
  const role = db.telegramAuthorizedUsers.getRole(userId);
  if (role !== 'owner' && role !== 'operator') {
    return `🚫 Onay yetkisine sahip değilsiniz.`;
  }
  
  // Update approval using the decide method
  db.lifecycleApprovals.decide(approvalId, decision, `telegram:${userId}`, null);
  
  // Find linked telegram command and update it
  const linkedCmd = db.telegramCommands.awaitingApproval().find((c: TelegramCommand) => c.approvalId === approvalId);
  if (linkedCmd) {
    db.telegramCommands.updateStatus(linkedCmd.id, 'completed', { responseText: `Onay: ${decision}` });
  }
  
  const emoji = decision === 'approved' ? '✅' : '❌';
  return `${emoji} *${approval.title}* ${decision === 'approved' ? 'onaylandı' : 'reddedildi'}.`;
}

// ── Main Gateway Entry Point ────────────────────────────────────────────────

export async function processTelegramUpdate(update: TelegramUpdate): Promise<GatewayResult> {
  const db = openDb(process.env.FOUNDER_OS_DB || ':memory:');
  const startTime = Date.now();
  
  try {
    const updateId = update.update_id;
    
    // ── 1. Idempotency Check ──
    if (db.telegramCommands.existsByUpdateId(updateId)) {
      return { success: true, status: 'duplicate', message: 'Update already processed' };
    }
    
    // Extract message info
    const message = update.message;
    const callbackQuery = update.callback_query;
    
    if (!message && !callbackQuery) {
      return { success: true, status: 'processed', message: 'No actionable content' };
    }
    
    const userId = message?.from.id || callbackQuery?.from.id || 0;
    const chatId = message?.chat.id || callbackQuery?.message?.chat.id || 0;
    const userName = [
      message?.from.first_name || callbackQuery?.from.first_name || '',
      message?.from.last_name || callbackQuery?.from.last_name || '',
    ].filter(Boolean).join(' ') || 'Unknown';
    const messageText = message?.text || callbackQuery?.data || '';
    
    if (!messageText) {
      return { success: true, status: 'processed', message: 'Empty message' };
    }
    
    // ── 2. Rate Limit Check ──
    if (!checkRateLimit(userId)) {
      await sendTelegramMessage(chatId, '⚠️ Çok fazla istek gönderdiniz. Lütfen bir dakika bekleyin.');
      return { success: false, status: 'rate_limited', message: 'Rate limit exceeded' };
    }
    
    // ── 3. Authorization Check ──
    const authCheck = checkAuthorization(db, userId);
    
    if (!authCheck.authorized) {
      await sendTelegramMessage(chatId, '🚫 Bu botu kullanma yetkiniz yok. Yöneticiyle iletişime geçin.');
      return { success: false, status: 'unauthorized', message: 'User not authorized' };
    }
    
    // ── 4. Create Command Record ──
    const commandId = randomUUID();
    const now = new Date().toISOString();
    
    const commandRecord: TelegramCommand = {
      id: commandId,
      updateId,
      chatId,
      userId,
      userName,
      messageText,
      routedToAgentId: null,
      projectId: null,
      lifecycleTaskId: null,
      approvalId: null,
      responseText: null,
      status: 'received',
      errorMessage: null,
      processingTimeMs: null,
      createdAt: now,
      updatedAt: now,
    };
    
    db.telegramCommands.insert(commandRecord);
    
    // ── 5. Parse and Route ──
    db.telegramCommands.updateStatus(commandId, 'processing', {});
    
    const parsed = parseCommand(messageText, callbackQuery?.data);
    let responseText = '';
    let finalStatus: 'completed' | 'failed' | 'awaiting_approval' = 'completed';
    let routingInfo: { agentId?: string; projectId?: string; taskId?: string; approvalId?: string } = {};
    
    try {
      if (parsed.type === 'system' && parsed.systemCommand) {
        responseText = await handleSystemCommand(db, parsed.systemCommand, chatId, userName);
      } else if (parsed.type === 'approval_response' && parsed.approvalData) {
        responseText = await handleApprovalResponse(db, parsed.approvalData.approvalId, parsed.approvalData.decision, userId);
      } else if (parsed.type === 'conductor_task' && parsed.conductorGoal) {
        const result = await routeToConductor(db, commandId, parsed.conductorGoal, chatId, userId);
        responseText = result.responseText;
        routingInfo = {
          agentId: result.agentId,
          projectId: result.projectId,
          taskId: result.taskId,
          approvalId: result.approvalId,
        };
        if (!result.success) {
          finalStatus = 'failed';
        } else if (result.approvalId) {
          finalStatus = 'awaiting_approval';
        }
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      responseText = `❌ Hata: ${errMsg.slice(0, 200)}`;
      finalStatus = 'failed';
      routingInfo = {};
    }
    
    // ── 6. Send Response ──
    await sendTelegramMessage(chatId, responseText);
    
    // ── 7. Update Command Record ──
    const processingTimeMs = Date.now() - startTime;
    db.telegramCommands.updateStatus(commandId, finalStatus, {
      routedToAgentId: routingInfo.agentId,
      projectId: routingInfo.projectId,
      lifecycleTaskId: routingInfo.taskId,
      approvalId: routingInfo.approvalId,
      responseText,
      processingTimeMs,
    });
    
    return {
      success: true,
      commandId,
      status: 'processed',
      responseText,
    };
    
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[TelegramGateway] Fatal error:', errMsg);
    return {
      success: false,
      status: 'error',
      message: errMsg,
    };
  }
}

// ── Notification Delivery ───────────────────────────────────────────────────

export async function sendTelegramNotification(
  chatId: number,
  notification: {
    type: 'info' | 'approval_request' | 'task_complete' | 'error';
    title: string;
    body: string;
    approvalId?: string;
  },
): Promise<void> {
  let text = '';
  
  switch (notification.type) {
    case 'info':
      text = `ℹ️ *${notification.title}*\n\n${notification.body}`;
      break;
    case 'approval_request':
      text = `🔔 *Onay Gerekiyor: ${notification.title}*\n\n${notification.body}`;
      // TODO: Add inline keyboard buttons for approve/reject
      break;
    case 'task_complete':
      text = `✅ *Tamamlandı: ${notification.title}*\n\n${notification.body}`;
      break;
    case 'error':
      text = `❌ *Hata: ${notification.title}*\n\n${notification.body}`;
      break;
  }
  
  await sendTelegramMessage(chatId, text);
}

// ── Admin Functions ─────────────────────────────────────────────────────────

export function addAuthorizedUser(
  userId: number,
  userName: string,
  role: 'owner' | 'operator' | 'viewer' = 'operator',
  addedBy = 'manual',
): void {
  const db = openDb(process.env.FOUNDER_OS_DB || ':memory:');
  db.telegramAuthorizedUsers.add({
    userId,
    userName,
    role,
    addedAt: new Date().toISOString(),
    addedBy,
  });
}

export function removeAuthorizedUser(userId: number): boolean {
  const db = openDb(process.env.FOUNDER_OS_DB || ':memory:');
  return db.telegramAuthorizedUsers.remove(userId);
}

export function listAuthorizedUsers(): TelegramAuthorizedUser[] {
  const db = openDb(process.env.FOUNDER_OS_DB || ':memory:');
  return db.telegramAuthorizedUsers.all();
}
