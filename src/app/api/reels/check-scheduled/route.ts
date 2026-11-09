import { NextResponse } from 'next/server';
import { processScheduledReels } from '@/services/reels';

export async function POST() {
  try {
    const result = await processScheduledReels();
    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

