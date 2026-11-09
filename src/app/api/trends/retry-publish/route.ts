import { NextRequest, NextResponse } from 'next/server';
import { retryTrendSourcesAndPublish } from '@/services/auto-runner';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { trendId, allMissing, dryRun, forcePublish, limit } = body;

    if (!trendId && !allMissing) {
      return NextResponse.json(
        { success: false, error: 'trendId hoặc allMissing: true là bắt buộc' },
        { status: 400 }
      );
    }

    const result = await retryTrendSourcesAndPublish({
      trendId,
      allMissing: Boolean(allMissing),
      dryRun: Boolean(dryRun),
      forcePublish: forcePublish !== undefined ? Boolean(forcePublish) : true,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

