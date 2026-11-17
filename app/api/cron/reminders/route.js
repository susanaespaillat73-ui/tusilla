import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { sendWhatsAppTemplate, waConfigured } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

// Lo llama Supabase (pg_cron) cada 10 minutos. Ver README, paso 6.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!waConfigured()) return NextResponse.json({ skipped: 'whatsapp_not_configured' });
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'missing_service_role_key' }, { status: 500 });

  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const now = Date.now();
  const iso = (ms) => new Date(now + ms).toISOString();
  const H = 3600e3;
  const result = { r24: 0, r2: 0, errors: 0 };

  const select = 'id,starts_at,created_at,customer_name,customer_phone,service_name,manage_token,staff:staff_id(name),biz:business_id!inner(name,address,auto_24h,auto_2h)';

  // Recordatorio del día antes: citas entre 3 h y 24 h desde ahora, reservadas con más de 20 h de anticipación.
  const { data: day } = await admin
    .from('appointments')
    .select(select)
    .eq('status', 'confirmed')
    .is('reminder_24h_sent_at', null)
    .gt('starts_at', iso(3 * H))
    .lte('starts_at', iso(24 * H))
    .eq('biz.auto_24h', true)
    .limit(100);

  for (const a of day || []) {
    if (Date.parse(a.starts_at) - Date.parse(a.created_at) < 20 * H) continue;
    const r = await sendWhatsAppTemplate('r24', flat(a, site));
    if (r.ok) {
      await admin.from('appointments').update({ reminder_24h_sent_at: new Date().toISOString() }).eq('id', a.id);
      result.r24++;
    } else result.errors++;
  }

  // Recordatorio 2 horas antes: citas en las próximas 2 h, reservadas con más de 3 h de anticipación.
  const { data: soon } = await admin
    .from('appointments')
    .select(select)
    .eq('status', 'confirmed')
    .is('reminder_2h_sent_at', null)
    .gt('starts_at', iso(0))
    .lte('starts_at', iso(2 * H))
    .eq('biz.auto_2h', true)
    .limit(100);

  for (const a of soon || []) {
    if (Date.parse(a.starts_at) - Date.parse(a.created_at) < 3 * H) continue;
    const r = await sendWhatsAppTemplate('r2', flat(a, site));
    if (r.ok) {
      await admin.from('appointments').update({ reminder_2h_sent_at: new Date().toISOString() }).eq('id', a.id);
      result.r2++;
    } else result.errors++;
  }

  return NextResponse.json(result);
}

function flat(a, site) {
  return {
    ...a,
    staff_name: a.staff?.name,
    business_name: a.biz?.name,
    address: a.biz?.address,
    link: `${site}/cita/${a.manage_token}`,
  };
}
