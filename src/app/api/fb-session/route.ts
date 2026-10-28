import { NextRequest, NextResponse } from 'next/server';
import { checkFacebookLoginStatus, launchInteractiveLogin } from '@/services/playwright/session';

export async function GET() {
  try {
    const status = await checkFacebookLoginStatus();
    return NextResponse.json({ success: true, status });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const initialUrl = body.url;
    // Launch interactive login non-blockingly
    launchInteractiveLogin(initialUrl).catch((e) => console.error('Interactive login error:', e));
    return NextResponse.json({
      success: true,
      message: initialUrl
        ? 'Cửa sổ trình duyệt đang được mở đến Fanpage của bạn. Hãy chuyển sang tư cách Fanpage và đóng cửa sổ khi hoàn tất, hệ thống sẽ tự động lưu phiên!'
        : 'Cửa sổ trình duyệt đang được mở. Hãy đăng nhập Facebook và chuyển sang Fanpage cần đăng bài, hệ thống sẽ tự động lưu phiên!',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
