import { NextRequest, NextResponse } from 'next/server';
import { postCommentToZaloReel } from '@/services/reels';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let comment: string | undefined;

    try {
      const body = await req.json();
      if (body && typeof body.comment === 'string') {
        comment = body.comment;
      }
    } catch {
      // Body is optional
    }

    const result = await postCommentToZaloReel(id, comment);
    return NextResponse.json({ success: result.success, message: result.message, error: result.error });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
