import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy file video để tải lên.' },
        { status: 400 }
      );
    }

    const videosDir = path.join(process.cwd(), 'storage', 'videos');
    if (!fs.existsSync(videosDir)) {
      fs.mkdirSync(videosDir, { recursive: true });
    }

    // Sanitize filename
    const originalName = file.name || 'reel.mp4';
    const ext = path.extname(originalName) || '.mp4';
    const baseName = path
      .basename(originalName, ext)
      .replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u1E00-\u1EFF]/g, '_');
    const safeFilename = `reel_${Date.now()}_${baseName}${ext}`;
    const targetFilePath = path.join(videosDir, safeFilename);

    // Save to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(targetFilePath, buffer);

    return NextResponse.json({
      success: true,
      filePath: targetFilePath,
      filename: safeFilename,
      originalName,
      size: file.size,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'Lỗi khi tải file video: ' + err.message },
      { status: 500 }
    );
  }
}

