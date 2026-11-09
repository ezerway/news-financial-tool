import { NextRequest, NextResponse } from 'next/server';
import { getReelById, updateReel, deleteReel } from '@/services/reels';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updated = updateReel(id, body);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Reel không tồn tại' }, { status: 404 });
    }

    return NextResponse.json({ success: true, reel: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = deleteReel(id);
    if (!success) {
      return NextResponse.json({ success: false, error: 'Reel không tồn tại' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

