import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/auth-token';

function expireAuthCookie(res: NextResponse) {
  res.cookies.delete(AUTH_COOKIE_NAME);
  res.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });
}

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: 'Đã đăng xuất thành công.',
  });

  expireAuthCookie(response);
  return response;
}

export async function GET(req: NextRequest) {
  const loginUrl = new URL('/login?logout=1', req.url);
  const response = NextResponse.redirect(loginUrl);

  expireAuthCookie(response);
  return response;
}
