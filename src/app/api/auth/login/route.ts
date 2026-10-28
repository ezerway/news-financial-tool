import { NextRequest, NextResponse } from 'next/server';
import { verifyCredentials } from '@/lib/auth-server';
import { createSessionToken, AUTH_COOKIE_NAME } from '@/lib/auth-token';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { username, password, rememberMe } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.' },
        { status: 400 }
      );
    }

    const check = verifyCredentials(String(username), String(password));
    if (!check.success) {
      return NextResponse.json(
        { success: false, error: check.error || 'Tên đăng nhập hoặc mật khẩu không chính xác.' },
        { status: 401 }
      );
    }

    const maxAge = rememberMe ? 30 * 86400 : 7 * 86400; // 30 days or 7 days
    const token = await createSessionToken(check.username, maxAge);

    const response = NextResponse.json({
      success: true,
      username: check.username,
      message: 'Đăng nhập thành công!',
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
