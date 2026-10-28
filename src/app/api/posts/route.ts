import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { PostItem } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    let query = 'SELECT * FROM posts';
    const params: any[] = [];

    if (status && status !== 'all') {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const rows = db.prepare(query).all(...params) as any[];
    const posts: PostItem[] = rows.map((r) => ({
      ...r,
      source_urls: r.source_urls ? JSON.parse(r.source_urls) : [],
    }));

    return NextResponse.json({ success: true, posts });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
