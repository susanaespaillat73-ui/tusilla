import { NextResponse } from 'next/server';
import { supabaseAdmin, supabasePublic } from '@/lib/supabase/server';
import { sendWhatsAppTemplate } from '@/lib/whatsapp';

const KNOWN = ['slot_taken', 'invalid_phone', 'invalid_name', 'too_many_bookings', 'business_not_found', 'business_inactive', 'service_not_found'];
const isUuid = (v) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);

export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.slug !== 'string' || !isUuid(body.service_id) || !body.starts_at || Number.isNaN(Date.parse(body.starts_at))) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  if (body.staff_id && !isUuid(body.staff_id)) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const supabase = supabasePublic();
  const { data, error } = await supabase.rpc('book_appointment', {
    p_slug: body.slug,
    p_service: body.service_id,
    p_staff: body.staff_id || null,
    p_starts_at: body.starts_at,
    p_name: String(body.name || '').slice(0, 80),
    p_phone: String(body.phone || '').slice(0, 20),
    p_notes: String(body.notes || '').slice(0, 300),
  });

  if (error) {
    const code = KNOWN.find((k) => (error.message || '').includes(k)) || 'unknown';
    if (code === 'unknown') console.error('book_appointment', error);
    return NextResponse.json({ error: code }, { status: code === 'unknown' ? 500 : 409 });
  }

  // Confirmación automática por WhatsApp (si la API de Meta está configurada)
  if (data.auto_confirm) {
    const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const sent = await sendWhatsAppTemplate('confirm', { ...data, link: `${site}/cita/${data.token}` });
    if (sent.ok) {
      const admin = supabaseAdmin();
      if (admin) await admin.from('appointments').update({ confirm_sent_at: new Date().toISOString() }).eq('id', data.id);
    } else if (!sent.skipped) {
      console.error('whatsapp confirm', sent.error);
    }
  }

  return NextResponse.json({ token: data.token });
}
