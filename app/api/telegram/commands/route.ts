/**
 * Telegram Commands API
 * 
 * Lists recent Telegram commands for the dashboard
 */

import { NextResponse } from 'next/server';
import { openDb } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const db = openDb(process.env.FOUNDER_OS_DB || ':memory:');
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const status = searchParams.get('status');
    
    let commands;
    if (status === 'awaiting_approval') {
      commands = db.telegramCommands.awaitingApproval();
    } else if (status === 'pending') {
      commands = db.telegramCommands.pending();
    } else {
      commands = db.telegramCommands.recent(limit);
    }
    
    // Get authorized users for display
    const authorizedUsers = db.telegramAuthorizedUsers.all();
    
    return NextResponse.json({
      ok: true,
      commands,
      authorizedUsers,
      stats: {
        total: commands.length,
        completed: commands.filter((c: { status: string }) => c.status === 'completed').length,
        failed: commands.filter((c: { status: string }) => c.status === 'failed').length,
        awaitingApproval: commands.filter((c: { status: string }) => c.status === 'awaiting_approval').length,
      },
    });
  } catch (error) {
    console.error('[API /telegram/commands] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
