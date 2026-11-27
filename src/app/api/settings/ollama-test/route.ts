import { NextRequest, NextResponse } from 'next/server';
import { checkOllamaHealth } from '@/services/ollama';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const endpoint = body.endpoint?.trim() || undefined;
    const model = body.model?.trim() || undefined;

    const result = await checkOllamaHealth(endpoint, model);

    return NextResponse.json({
      success: result.ok,
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        ok: false,
        message: err.message || 'Lỗi khi kiểm tra kết nối Ollama',
      },
      { status: 500 }
    );
  }
}
