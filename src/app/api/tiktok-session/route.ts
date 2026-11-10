import { NextRequest, NextResponse } from 'next/server';
import {
  checkTikTokLoginStatus,
  launchInteractiveTikTokLogin,
  parseAndSaveTikTokCookies,
} from '@/services/playwright/tiktok-session';

export async function GET() {
  try {
    const status = await checkTikTokLoginStatus();
    const isHeadless = process.platform === 'linux' && !process.env.DISPLAY;
    return NextResponse.json({ success: true, status, isHeadless });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const isHeadless = process.platform === 'linux' && !process.env.DISPLAY;

    // 1. Raw cookies string / JSON array
    if (body.rawCookies && typeof body.rawCookies === 'string' && body.rawCookies.trim()) {
      const saveResult = parseAndSaveTikTokCookies(body.rawCookies);
      const status = await checkTikTokLoginStatus();
      return NextResponse.json({
        success: saveResult.success,
        message: saveResult.message,
        status,
      });
    }

    // 2. Launch interactive browser window (Only available when DISPLAY exists)
    if (isHeadless) {
      return NextResponse.json(
        {
          success: false,
          isHeadless: true,
          error:
            'Máy chủ VPS đang chạy ở chế độ Headless (không có màn hình GUI). Không thể mở cửa sổ trình duyệt Chromium. Vui lòng chuyển sang dán Cookie TikTok hoặc tải file tiktok-session.json lên!',
        },
        { status: 400 }
      );
    }

    const initialUrl = body.url || 'https://www.tiktok.com/login';
    launchInteractiveTikTokLogin(initialUrl).catch((e: unknown) => {
      const errStr = e instanceof Error ? e.message : String(e);
      console.error('Interactive TikTok login error:', errStr);
    });

    return NextResponse.json({
      success: true,
      message: 'Cửa sổ trình duyệt đang được mở. Hãy đăng nhập TikTok của bạn và đóng trình duyệt khi hoàn tất, hệ thống sẽ tự động lưu phiên!',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

