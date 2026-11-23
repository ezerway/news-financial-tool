import { NextRequest, NextResponse } from 'next/server';
import {
  checkZaloLoginStatus,
  launchInteractiveZaloLogin,
} from '@/services/playwright/zalo-session';

export async function GET() {
  try {
    const status = await checkZaloLoginStatus();
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

    if (isHeadless) {
      return NextResponse.json(
        {
          success: false,
          isHeadless: true,
          error:
            'Máy chủ VPS đang chạy ở chế độ Headless (không có màn hình GUI). Không thể mở cửa sổ trình duyệt Chromium trực tiếp.',
        },
        { status: 400 }
      );
    }

    const initialUrl = body.url || 'https://video.zalo.me/creator/video';
    launchInteractiveZaloLogin(initialUrl).catch((e: unknown) => {
      const errStr = e instanceof Error ? e.message : String(e);
      console.error('Interactive Zalo login error:', errStr);
    });

    return NextResponse.json({
      success: true,
      message: 'Cửa sổ trình duyệt đang được mở. Hãy đăng nhập tài khoản Zalo Video Creator của bạn, phiên sẽ tự động lưu!',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
