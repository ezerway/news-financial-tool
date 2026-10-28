import { NextRequest, NextResponse } from 'next/server';
import { exportDbSqlite, exportDbJson, importDbSqlite, importDbJson } from '@/services/backup';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'sqlite';
    const dateStr = new Date().toISOString().slice(0, 10);

    if (format === 'json') {
      const jsonStr = exportDbJson();
      return new Response(jsonStr, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="trendpulse_db_${dateStr}.json"`,
        },
      });
    }

    // Default: SQLite backup
    const buffer = await exportDbSqlite();
    return new Response(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.sqlite3',
        'Content-Disposition': `attachment; filename="trendpulse_db_${dateStr}.db"`,
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
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.json')) {
      const json = JSON.parse(buffer.toString('utf-8'));
      const result = await importDbJson(json);
      return NextResponse.json(result);
    }

    // Default treat as SQLite file (.db, .sqlite)
    const result = await importDbSqlite(buffer);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
