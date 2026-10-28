import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, AUTH_COOKIE_NAME } from '@/lib/auth-token';

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Skip static assets, Next.js internal files, PWA files, and public routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/api/auth/session') ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname === '/offline.html' ||
    pathname.startsWith('/icon-') ||
    (pathname.includes('.') && !pathname.endsWith('.html'))
  ) {
    return NextResponse.next();
  }

  // 2. Read and verify session token
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);
  const isAuthenticated = session.valid;

  // 3. If accessing /login
  if (pathname === '/login') {
    if (isAuthenticated) {
      // Already logged in, redirect to dashboard
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  // 4. If not authenticated, block or redirect
  if (!isAuthenticated) {
    // If it's an API route, return 401 JSON
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Yêu cầu đăng nhập. Phiên làm việc không hợp lệ hoặc đã hết hạn.' },
        { status: 401 }
      );
    }

    // For web page requests, redirect to /login with return URL
    const loginUrl = new URL('/login', req.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect', pathname + req.nextUrl.search);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export default proxy;

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
