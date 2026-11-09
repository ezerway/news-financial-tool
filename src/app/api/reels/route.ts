import { NextRequest, NextResponse } from 'next/server';
import { getReels, createReel, processScheduledReels } from '@/services/reels';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;

    // Trigger scheduled check in background without blocking
    processScheduledReels().catch(() => {});

    const reels = getReels(status);
    return NextResponse.json({ success: true, reels });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { video_path, video_filename, caption, scheduled_at, status } = body;

    if (!video_path || typeof video_path !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Đường dẫn file video không được để trống' },
        { status: 400 }
      );
    }

    const reel = createReel({
      video_path,
      video_filename,
      caption,
      scheduled_at,
      status,
    });

    return NextResponse.json({ success: true, reel });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

