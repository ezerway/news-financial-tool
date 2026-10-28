import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updates: string[] = [];
    const values: any[] = [];

    if (body.post_content !== undefined) {
      updates.push('post_content = ?');
      values.push(body.post_content);
    }
    if (body.comment_content !== undefined) {
      updates.push('comment_content = ?');
      values.push(body.comment_content);
    }
    if (body.status !== undefined) {
      updates.push('status = ?');
      values.push(body.status);
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: true, message: 'No changes provided' });
    }

    values.push(id);
    db.prepare(`UPDATE posts SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Reset trend status back to 'discovered' so it can be drafted again if desired
    const post = db.prepare('SELECT trend_id FROM posts WHERE id = ?').get(id) as { trend_id?: string } | undefined;
    if (post?.trend_id) {
      db.prepare("UPDATE trends SET status = 'discovered' WHERE id = ?").run(post.trend_id);
    }

    db.prepare('DELETE FROM posts WHERE id = ?').run(id);
    return NextResponse.json({ success: true, message: 'Post deleted successfully' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
