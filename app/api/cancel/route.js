import { NextResponse } from 'next/server';
import { supabasePublic } from '@/lib/supabase/server';

export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body || !/^[0-9a-f-]{36}$/i.test(body.token || '')) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const { data, error } = await supabasePublic().rpc('cancel_appointment_by_token', { p_token: body.token });
  if (error) {
    const code = (error.message || '').includes('cannot_cancel') ? 'cannot_cancel' : 'unknown';
    return NextResponse.json({ error: code }, { status: 409 });
  }
  return NextResponse.json({ ok: true, status: data?.status });
}
