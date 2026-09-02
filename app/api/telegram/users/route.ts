/**
 * Telegram Authorized Users API
 * 
 * Manage authorized Telegram users
 */

import { NextResponse } from 'next/server';
import { openDb } from '@/lib/db';
import { addAuthorizedUser, removeAuthorizedUser } from '@/lib/telegram-gateway';

export async function GET() {
  try {
    const db = openDb(process.env.FOUNDER_OS_DB || ':memory:');
    const users = db.telegramAuthorizedUsers.all();
    
    return NextResponse.json({
      ok: true,
      users,
      count: users.length,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, userName, role } = body;
    
    if (!userId || typeof userId !== 'number') {
      return NextResponse.json(
        { ok: false, error: 'userId (number) is required' },
        { status: 400 },
      );
    }
    
    addAuthorizedUser(userId, userName || '', role || 'operator', 'api');
    
    return NextResponse.json({
      ok: true,
      message: `User ${userId} authorized as ${role || 'operator'}`,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = parseInt(searchParams.get('userId') || '', 10);
    
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'userId query param required' },
        { status: 400 },
      );
    }
    
    const removed = removeAuthorizedUser(userId);
    
    return NextResponse.json({
      ok: true,
      removed,
      message: removed ? `User ${userId} removed` : `User ${userId} not found`,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
