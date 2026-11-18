import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SiteHeader, SiteFooter } from '@/components/Site';
import BookingWidget from '@/components/BookingWidget';
import { supabaseServer } from '@/lib/supabase/server';
import { CATEGORIES, DOW_LONG, WEEK_ORDER, contrastText, fmtPhone, h12, timeShort, waLink } from '@/lib/format';

export const dynamic = 'force-dynamic';

async function loadBusiness(slug) {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return null;
  const supabase = supabaseServer();
  const { data } = await supabase.from('businesses').select('*').eq('slug', slug).maybeSingle();
  return data;
}

export async function generateMetadata({ params }) {
  const b = await loadBusiness(params.slug);
  if (!b) return { title: 'Negocio no encontrado' };
  const desc = b.description || `Reserva tu cita en ${b.name}${b.city ? ', ' + b.city : ''}. Elige servicio y hora en línea.`;
  return {
    title: `${b.name} · Reserva tu cita`,
    description: desc,
    openGraph: { title: `${b.name} · Reserva tu cita`, description: desc, images: b.logo_url ? [b.logo_url] : undefined },
  };
}

export default async function BusinessPage({ params }) {
  const biz = await loadBusiness(params.slug);
  if (!biz) notFound();

  const supabase = supabaseServer();
  const [{ data: canBook }, { data: { user } }] = await Promise.all([
    supabase.rpc('business_can_book', { p_slug: biz.slug }),
    supabase.auth.getUser(),
  ]);
  const isOwner = user?.id === biz.owner_id;
  const [{ data: services }, { data: staff }] = await Promise.all([
    supabase.from('services').select('id,name,description,duration_min,price').eq('business_id', biz.id).eq('is_active', true).order('sort').order('created_at'),
    supabase.from('staff').select('id,name,role').eq('business_id', biz.id).eq('is_active', true).order('sort').order('created_at'),
  ]);
  const staffIds = (staff || []).map((s) => s.id);
  const [{ data: hours }, { data: staffServices }] = staffIds.length
    ? await Promise.all([
        supabase.from('working_hours').select('staff_id,weekday,start_time,end_time').in('staff_id', staffIds),
        supabase.from('staff_services').select('staff_id,service_id').in('staff_id', staffIds),
      ])
    : [{ data: [] }, { data: [] }];

  // Horario del negocio = desde la primera entrada hasta la última salida de cada día.
  const byDay = {};
  for (const h of hours || []) {
    const d = byDay[h.weekday] || (byDay[h.weekday] = { s: h.start_time, e: h.end_time });
    if (h.start_time < d.s) d.s = h.start_time;
    if (h.end_time > d.e) d.e = h.end_time;
  }

  const style = { '--accent': biz.accent, '--accent-ink': contrastText(biz.accent) };
  const ig = biz.instagram ? biz.instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '') : '';

  return (
    <div style={style}>
      <SiteHeader>
        <a className="link" href={waLink(biz.phone)} target="_blank" rel="noopener">WhatsApp {fmtPhone(biz.phone)}</a>
      </SiteHeader>
      <main className="wrap">
        {isOwner && !biz.is_published && (
          <p className="note warn" style={{ marginTop: 16 }}>
            Tu página está oculta. Solo tú la ves. Actívala en <Link href="/panel/ajustes">Ajustes</Link> para recibir reservas.
          </p>
        )}
        {isOwner && biz.is_published && !canBook && (
          <p className="note warn" style={{ marginTop: 16 }}>
            Tu cuenta está vencida y tu página no está recibiendo reservas. Revisa <Link href="/panel/ajustes#plan">Mi plan</Link> para reactivarla.
          </p>
        )}
        <section className="biz-hero">
          {biz.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="biz-logo" src={biz.logo_url} alt={`Logo de ${biz.name}`} />
          ) : (
            <div className="biz-logo" aria-hidden="true">{biz.name.slice(0, 1)}</div>
          )}
          <div className="stack tight" style={{ flex: '1 1 220px' }}>
            <p className="eyebrow">{CATEGORIES[biz.category]}{biz.city ? ` · ${biz.city}` : ''}</p>
            <h1 style={{ fontSize: 'clamp(1.9rem, 4.5vw, 2.8rem)' }}>{biz.name}</h1>
            <div className="biz-meta">
              {biz.address && <span>{biz.address}</span>}
              {ig && <a href={`https://instagram.com/${ig}`} target="_blank" rel="noopener">@{ig}</a>}
            </div>
            {biz.description && <p className="muted" style={{ maxWidth: '65ch' }}>{biz.description}</p>}
          </div>
        </section>

        {!canBook ? (
          <div className="empty-state" style={{ marginBottom: 48 }}>
            <b>Este negocio no está recibiendo reservas en línea en este momento.</b>
            <span>Puedes escribirle por WhatsApp al {fmtPhone(biz.phone)}.</span>
            <a className="btn btn-wa btn-sm" href={waLink(biz.phone, `Hola ${biz.name}, quisiera hacer una cita.`)} target="_blank" rel="noopener">Escribir por WhatsApp</a>
          </div>
        ) : services?.length && staff?.length ? (
          <BookingWidget
            biz={{ slug: biz.slug, name: biz.name, max_days_ahead: biz.max_days_ahead, cancel_hours: biz.cancel_hours }}
            services={services}
            staff={staff}
            hours={hours || []}
            staffServices={staffServices || []}
            hoursBlock={
              <div className="hours-list">
                {WEEK_ORDER.map((d) => (
                  <FragmentRow key={d} day={DOW_LONG[d]} v={byDay[d] ? `${h12(timeShort(byDay[d].s))} – ${h12(timeShort(byDay[d].e))}` : 'Cerrado'} />
                ))}
              </div>
            }
          />
        ) : (
          <div className="empty-state" style={{ marginBottom: 48 }}>
            <b>Este negocio todavía está preparando su agenda.</b>
            <span>Mientras tanto puedes escribirle por WhatsApp al {fmtPhone(biz.phone)}.</span>
            <a className="btn btn-wa btn-sm" href={waLink(biz.phone, `Hola ${biz.name}, quisiera hacer una cita.`)} target="_blank" rel="noopener">Escribir por WhatsApp</a>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function FragmentRow({ day, v }) {
  return (
    <>
      <span className="muted">{day}</span>
      <span className="num">{v}</span>
    </>
  );
}
