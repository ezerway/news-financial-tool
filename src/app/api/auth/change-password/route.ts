import { NextRequest, NextResponse } from 'next/server';
import { updateAdminCredentials } from '@/lib/auth-server';
import { verifySessionToken, createSessionToken, AUTH_COOKIE_NAME } from '@/lib/auth-token';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = await verifySessionToken(token);

    if (!session.valid) {
      return NextResponse.json({ success: false, error: 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { currentPassword, newUsername, newPassword } = body;

    if (!currentPassword) {
      return NextResponse.json({ success: false, error: 'Vui lòng nhập mật khẩu hiện tại để xác thực.' }, { status: 400 });
    }

    const result = updateAdminCredentials(currentPassword, newUsername, newPassword);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    const updatedUser = newUsername || session.username || 'admin';
    const newToken = await createSessionToken(updatedUser, 7 * 86400);

    const response = NextResponse.json({
      success: true,
      message: result.message || 'Cập nhật tài khoản quản trị thành công!',
      username: updatedUser,
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: newToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 86400,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
