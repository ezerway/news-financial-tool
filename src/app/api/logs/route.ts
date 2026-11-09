import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { ActivityLog } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const action = searchParams.get('action');
    const level = searchParams.get('level');

    let query = 'SELECT * FROM activity_logs';
    let countQuery = 'SELECT COUNT(*) as count FROM activity_logs';
    const whereClauses: string[] = [];
    const params: any[] = [];
    const countParams: any[] = [];

    if (action && action !== 'all') {
      whereClauses.push('action = ?');
      params.push(action);
      countParams.push(action);
    }

    if (level && level !== 'all') {
      whereClauses.push('level = ?');
      params.push(level);
      countParams.push(level);
    }

    if (whereClauses.length > 0) {
      const whereSql = ' WHERE ' + whereClauses.join(' AND ');
      query += whereSql;
      countQuery += whereSql;
    }

    query += ' ORDER BY created_at DESC';

    const isAll = limitParam === 'all' || limitParam === '-1';
    const limitNum = isAll ? null : parseInt(limitParam || '200', 10);

    if (limitNum && !isNaN(limitNum) && limitNum > 0) {
      query += ' LIMIT ?';
      params.push(limitNum);
    }

    const logs = db.prepare(query).all(...params) as ActivityLog[];
    const totalRow = db.prepare(countQuery).get(...countParams) as { count: number } | undefined;
    const total = totalRow?.count ?? logs.length;

    return NextResponse.json({ success: true, logs, total });
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
