import { NextRequest, NextResponse } from 'next/server';
import { testTelegramNotification } from '@/services/notifications';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { botToken, chatId } = body;

    if (!botToken || !chatId) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập cả Telegram Bot Token và Chat ID.' },
        { status: 400 }
      );
    }

    const result = await testTelegramNotification(botToken, chatId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}

