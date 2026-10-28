import { NextRequest, NextResponse } from 'next/server';
import { exportFullBackupZip, importFullBackupZip } from '@/services/backup';

export async function GET() {
  try {
    const buffer = await exportFullBackupZip();
    const dateStr = new Date().toISOString().slice(0, 10);
    return new Response(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="trendpulse_full_backup_${dateStr}.zip"`,
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
    const result = await importFullBackupZip(buffer);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
