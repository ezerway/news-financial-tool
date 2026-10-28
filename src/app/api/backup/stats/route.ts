import { NextResponse } from 'next/server';
import { getBackupStats } from '@/services/backup';

export async function GET() {
  try {
    const stats = await getBackupStats();
    return NextResponse.json({ success: true, stats });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
