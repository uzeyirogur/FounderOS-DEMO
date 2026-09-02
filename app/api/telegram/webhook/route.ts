/**
 * Telegram Webhook Handler
 * 
 * Production-safe endpoint that:
 * - Validates webhook signature
 * - Delegates to TelegramGateway for idempotent processing
 * - Returns 200 OK immediately (Telegram retries on failure)
 * 
 * All actual processing, authorization, rate limiting, DB logging,
 * and conductor routing happens in telegram-gateway.ts
 */

import { NextResponse } from 'next/server';
import { processTelegramUpdate, type TelegramUpdate } from '@/lib/telegram-gateway';

// Telegram webhook secret for validation (optional but recommended)
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

export async function POST(request: Request) {
  const startTime = Date.now();
  
  try {
    // Parse the update
    const update: TelegramUpdate = await request.json();
    
    // Basic validation
    if (!update || typeof update.update_id !== 'number') {
      console.warn('[Telegram Webhook] Invalid update payload');
      return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
    }
    
    // Optional: Validate webhook secret header
    if (WEBHOOK_SECRET) {
      const secretHeader = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
      if (secretHeader !== WEBHOOK_SECRET) {
        console.warn('[Telegram Webhook] Invalid secret token');
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
      }
    }
    
    // Process through gateway (handles everything: auth, rate limit, idempotency, routing)
    const result = await processTelegramUpdate(update);
    
    const elapsed = Date.now() - startTime;
    
    // Log for monitoring
    console.log(`[Telegram Webhook] update_id=${update.update_id} status=${result.status} time=${elapsed}ms`);
    
    // Always return 200 to Telegram to prevent retries
    // Even on errors, we've logged them and don't want Telegram hammering us
    return NextResponse.json({
      ok: true,
      status: result.status,
      commandId: result.commandId,
      processingTimeMs: elapsed,
    });
    
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[Telegram Webhook] Fatal error:', errMsg);
    
    // Still return 200 to prevent Telegram retries on transient errors
    // The error is logged for investigation
    return NextResponse.json({
      ok: false,
      error: 'Internal error',
      processingTimeMs: Date.now() - startTime,
    });
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'Telegram webhook aktif',
    timestamp: new Date().toISOString(),
    features: [
      'idempotency',
      'authorization',
      'rate_limiting',
      'audit_logging',
      'conductor_routing',
      'approval_flow',
    ],
  });
}
