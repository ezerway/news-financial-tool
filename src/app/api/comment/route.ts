import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { executeCommentOnly } from '@/services/playwright/fb-automation';
import { PostItem } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { postId, postUrl, headless } = await req.json();

    if (!postId) {
      return NextResponse.json({ success: false, error: 'postId is required' }, { status: 400 });
    }

    const row = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId) as any;
    if (!row) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
    }

    const post: PostItem = {
      ...row,
      source_urls: row.source_urls ? JSON.parse(row.source_urls) : [],
    };

    const result = await executeCommentOnly(post, {
      postUrl: postUrl ? String(postUrl).trim() : undefined,
      headless: headless !== undefined ? Boolean(headless) : true,
    });

    return NextResponse.json({ success: result.success, result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
