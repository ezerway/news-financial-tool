import { NextRequest, NextResponse } from 'next/server';

/**
 * Route trung gian điều hướng: /go/?to=[target_url]
 * Nhận tham số `to`, kiểm tra an toàn và redirect 302 tới liên kết đích
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const to = searchParams.get('to');

  if (to && (to.startsWith('http://') || to.startsWith('https://'))) {
    try {
      const targetUrl = new URL(to);
      return NextResponse.redirect(targetUrl.toString(), { status: 302 });
    } catch {
      return NextResponse.redirect(to, { status: 302 });
    }
  }

  // Nếu không có tham số `to` hợp lệ, chuyển hướng về trang chủ
  return NextResponse.redirect(new URL('/', request.url), { status: 302 });
}
