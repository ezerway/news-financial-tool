import { NextRequest, NextResponse } from 'next/server';
import { exportProfileSession, exportProfileZip, importProfile } from '@/services/backup';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'session';
    const dateStr = new Date().toISOString().slice(0, 10);

    if (type === 'zip' || type === 'full') {
      const buffer = await exportProfileZip();
      return new Response(buffer as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="fb_profile_${dateStr}.zip"`,
        },
      });
    }

    // Default: session JSON
    const result = exportProfileSession();
    if (!result.exists || !result.data) {
      return NextResponse.json({
        success: false,
        error: 'Chưa có file phiên Facebook (storage/fb-session.json). Vui lòng đăng nhập kết nối Facebook trước.',
      }, { status: 404 });
    }

    return new Response(result.data, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="fb-session.json"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy tập tin tải lên' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const result = await importProfile(buffer, file.name);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
