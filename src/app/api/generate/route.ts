import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { generateSocialPost } from '@/services/ai-generator';
import { TrendItem } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { trendId, customTone } = await req.json();

    if (!trendId) {
      return NextResponse.json({ success: false, error: 'trendId is required' }, { status: 400 });
    }

    const row = db.prepare('SELECT * FROM trends WHERE id = ?').get(trendId) as any;
    if (!row) {
      return NextResponse.json({ success: false, error: 'Trend not found' }, { status: 404 });
    }

    const trend: TrendItem = {
      ...row,
      articles: row.articles_json ? JSON.parse(row.articles_json) : [],
    };

    const post = await generateSocialPost(trend, customTone);
    return NextResponse.json({ success: true, post });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
