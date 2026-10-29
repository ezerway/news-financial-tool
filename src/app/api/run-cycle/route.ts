import { NextRequest, NextResponse } from 'next/server';
import { runAutomationCycle } from '@/services/auto-runner';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await runAutomationCycle({
      forcePublish: body.forcePublish,
      dryRun: body.dryRun,
      limit: body.limit ? parseInt(body.limit, 10) : undefined,
    });
    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
