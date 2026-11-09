import { NextRequest, NextResponse } from 'next/server';
import { publishReelById } from '@/services/reels';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let headless = true;

    try {
      const body = await req.json();
      if (body && body.headless !== undefined) {
        headless = Boolean(body.headless);
      }
    } catch {
      // Body is optional
    }

    const result = await publishReelById(id, { headless });
    return NextResponse.json({ success: result.success, result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

