import { NextRequest, NextResponse } from 'next/server';
import { testTelegramNotification, testSlackNotification } from '@/services/notifications';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { channel = 'telegram', botToken, chatId, webhookUrl } = body;

    if (channel === 'slack' || webhookUrl) {
      if (!webhookUrl) {
        return NextResponse.json(
          { success: false, error: 'Vui lòng cung cấp Slack Incoming Webhook URL.' },
          { status: 400 }
        );
      }
      const result = await testSlackNotification(webhookUrl);
      return NextResponse.json(result);
    }

    // Default to telegram
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
