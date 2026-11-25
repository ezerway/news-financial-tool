import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import db from '@/lib/db';
import { getStorageDir } from '@/services/playwright/session';
import {
  formatBytes,
  getDirStats,
  cleanOldReelsStorage,
  cleanAllStorage,
} from '@/services/storage-cleanup';

export async function GET() {
  try {
    const storageDir = getStorageDir();
    const screenshotsDir = path.join(/*turbopackIgnore: true*/ storageDir, 'screenshots');
    const videosDir = path.join(/*turbopackIgnore: true*/ storageDir, 'videos');

    const scStats = getDirStats(screenshotsDir);
    const vdStats = getDirStats(videosDir);
    const totalBytes = scStats.sizeBytes + vdStats.sizeBytes;

    let postsCount = 0;
    let reelsCount = 0;
    let trendsCount = 0;
    try {
      const p = db.prepare('SELECT COUNT(*) as c FROM posts').get() as any;
      postsCount = p?.c || 0;
      const r = db.prepare('SELECT COUNT(*) as c FROM reels').get() as any;
      reelsCount = r?.c || 0;
      const t = db.prepare('SELECT COUNT(*) as c FROM trends').get() as any;
      trendsCount = t?.c || 0;
    } catch {}

    return NextResponse.json({
      success: true,
      screenshots: {
        count: scStats.count,
        sizeBytes: scStats.sizeBytes,
        sizeFormatted: formatBytes(scStats.sizeBytes),
      },
      videos: {
        count: vdStats.count,
        sizeBytes: vdStats.sizeBytes,
        sizeFormatted: formatBytes(vdStats.sizeBytes),
      },
      totalCount: scStats.count + vdStats.count,
      totalSizeBytes: totalBytes,
      totalFormatted: formatBytes(totalBytes),
      postsCount,
      reelsCount,
      trendsCount,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    const type = body?.type || 'all';
    const days = typeof body?.days === 'number' ? body.days : 2;

    if (type === 'old_reels' || type === 'reels') {
      const result = await cleanOldReelsStorage(days);
      return NextResponse.json({
        type: 'old_reels',
        days,
        ...result,
      });
    }

    // Mặc định: Dọn dẹp toàn bộ screenshots và videos
    const result = await cleanAllStorage();
    return NextResponse.json({
      type: 'all',
      ...result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
