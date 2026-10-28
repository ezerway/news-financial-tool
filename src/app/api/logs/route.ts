import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { ActivityLog } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const action = searchParams.get('action');

    let query = 'SELECT * FROM activity_logs';
    const params: any[] = [];

    if (action && action !== 'all') {
      query += ' WHERE action = ?';
      params.push(action);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const logs = db.prepare(query).all(...params) as ActivityLog[];
    return NextResponse.json({ success: true, logs });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    db.prepare('DELETE FROM activity_logs').run();
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
