import { NextResponse } from 'next/server';
import { waConfigured } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    configured: waConfigured(),
    cron: Boolean(process.env.CRON_SECRET),
  });
}
