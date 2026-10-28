import { NextRequest, NextResponse } from 'next/server';
import { crawlGoogleTrends, getStoredTrends } from '@/services/crawler';
import { getSetting } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const geo = searchParams.get('geo') || 'all';
    const category = searchParams.get('category') || 'all';
    const status = searchParams.get('status') || 'all';
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    const trends = getStoredTrends({ geo, category, status, limit });
    return NextResponse.json({ success: true, trends });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const geo = body.geo || getSetting('target_geo', 'VN');

    const trends = await crawlGoogleTrends(geo);
    return NextResponse.json({ success: true, count: trends.length, trends });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
