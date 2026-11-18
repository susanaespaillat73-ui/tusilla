import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { sendWhatsAppTemplate, waConfigured, WA_TEMPLATES } from '@/lib/whatsapp';
import { validPhone } from '@/lib/format';

export const dynamic = 'force-dynamic';

// Envía las plantillas con datos de ejemplo al número que indique la dueña del negocio.
export async function POST(request) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión otra vez.' }, { status: 401 });
  if (!waConfigured()) return NextResponse.json({ error: 'WhatsApp todavía no está conectado en el servidor.' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const kind = ['confirm', 'r24', 'r2'].includes(body.kind) ? body.kind : 'confirm';
  if (!validPhone(body.phone)) return NextResponse.json({ error: 'El número debe tener 10 dígitos y empezar por 809, 829 u 849.' }, { status: 400 });

  const { data: biz } = await supabase.from('businesses').select('name,address,slug').eq('owner_id', user.id).order('created_at').limit(1).maybeSingle();
  if (!biz) return NextResponse.json({ error: 'No encontramos tu negocio.' }, { status: 404 });

  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const result = await sendWhatsAppTemplate(kind, {
    customer_name: 'Prueba',
    customer_phone: body.phone,
    business_name: biz.name,
    address: biz.address || biz.name,
    service_name: 'Servicio de prueba',
    staff_name: 'tu equipo',
    starts_at: new Date(Date.now() + 864e5).toISOString(),
    link: `${site}/${biz.slug}`,
  });

  if (!result.ok) {
    return NextResponse.json({ error: `Meta rechazó el envío de "${WA_TEMPLATES[kind]}": ${result.error}` }, { status: 502 });
  }
  return NextResponse.json({ ok: true, template: WA_TEMPLATES[kind] });
}
