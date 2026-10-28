import { NextRequest, NextResponse } from 'next/server';
import {
  checkFacebookLoginStatus,
  launchInteractiveLogin,
  saveRawFacebookCookies,
} from '@/services/playwright/session';

export async function GET() {
  try {
    const status = await checkFacebookLoginStatus();
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

    // 1. Direct Cookie input (c_user & xs) - Best for VPS
    if (body.cUser && body.xs) {
      const saveResult = saveRawFacebookCookies(body.cUser, body.xs);
      const status = await checkFacebookLoginStatus();
      return NextResponse.json({
        success: true,
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
            'Máy chủ VPS đang chạy ở chế độ Headless (không có màn hình GUI). Không thể mở cửa sổ trình duyệt Chromium. Vui lòng chuyển sang tab "Nhập Cookie Facebook" (c_user & xs) hoặc tải file fb-session.json lên!',
        },
        { status: 400 }
      );
    }

    const initialUrl = body.url;
    // Launch interactive login non-blockingly on desktop environment
    launchInteractiveLogin(initialUrl).catch((e: unknown) => {
      const errStr = e instanceof Error ? e.message : String(e);
      console.error('Interactive login error:', errStr);
    });

    return NextResponse.json({
      success: true,
      message: initialUrl
        ? 'Cửa sổ trình duyệt đang được mở đến Fanpage của bạn. Hãy chuyển sang tư cách Fanpage và đóng cửa sổ khi hoàn tất, hệ thống sẽ tự động lưu phiên!'
        : 'Cửa sổ trình duyệt đang được mở. Hãy đăng nhập Facebook và chuyển sang Fanpage cần đăng bài, hệ thống sẽ tự động lưu phiên!',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
