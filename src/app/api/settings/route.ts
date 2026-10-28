import { NextRequest, NextResponse } from 'next/server';
import { getAllSettings, setSetting } from '@/lib/db';
import { checkFacebookLoginStatus } from '@/services/playwright/session';

export async function GET() {
  try {
    const settings = getAllSettings();
    const fbStatus = await checkFacebookLoginStatus();

    return NextResponse.json({
      success: true,
      settings,
      fbStatus,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string') {
        setSetting(key, value);
      }
    }
    return NextResponse.json({ success: true, settings: getAllSettings() });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
