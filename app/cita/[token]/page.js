import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SiteHeader, SiteFooter } from '@/components/Site';
import CitaActions from '@/components/CitaActions';
import { supabasePublic } from '@/lib/supabase/server';
import { STATUS, capitalize, contrastText, fmtDateLong, fmtPhone, fmtTime, money, waLink } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tu cita', robots: { index: false } };

export default async function CitaPage({ params, searchParams }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.token)) notFound();
  const { data: a } = await supabasePublic().rpc('get_appointment_by_token', { p_token: params.token });
  if (!a) notFound();

  const isNew = searchParams?.nueva === '1' && a.status === 'confirmed';
  const site = process.env.NEXT_PUBLIC_SITE_URL || '';
  const gcal = (() => {
    const f = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const u = new URL('https://calendar.google.com/calendar/render');
    u.searchParams.set('action', 'TEMPLATE');
    u.searchParams.set('text', `${a.service_name} · ${a.business_name}`);
    u.searchParams.set('dates', `${f(a.starts_at)}/${f(a.ends_at)}`);
    u.searchParams.set('location', [a.address, a.city].filter(Boolean).join(', '));
    u.searchParams.set('details', `Cita reservada con TuSilla. Ver o cancelar: ${site}/cita/${params.token}`);
    return u.toString();
  })();

  const style = { '--accent': a.accent, '--accent-ink': contrastText(a.accent) };
  const title = isNew
    ? `¡Listo, ${a.customer_name.split(' ')[0]}! Tu cita está reservada.`
    : a.status === 'cancelled' ? 'Esta cita fue cancelada' : `Tu cita en ${a.business_name}`;

  return (
    <div style={style}>
      <SiteHeader>
        <Link className="link" href={`/${a.slug}`}>{a.business_name}</Link>
      </SiteHeader>
      <main className="wrap narrow done">
        <div className={`check ${a.status === 'cancelled' ? 'bad' : ''}`}>{a.status === 'cancelled' ? '×' : '✓'}</div>
        <h1 style={{ fontSize: 'clamp(1.7rem, 4vw, 2.3rem)' }}>{title}</h1>
        {isNew && (
          <p className="muted">
            Guarda este link: con él puedes ver o cancelar tu cita. Si el negocio tiene los recordatorios activos, también te llega por WhatsApp.
          </p>
        )}
        <div className="card">
          <div className="row between"><h3>{a.service_name}</h3><span className={`pill ${a.status}`}>{STATUS[a.status]}</span></div>
          <div className="kv"><span>Cuándo</span><span>{capitalize(fmtDateLong(a.starts_at))}, {fmtTime(a.starts_at)}</span></div>
          <div className="kv"><span>Con</span><span>{a.staff_name || 'Por asignar'}</span></div>
          <div className="kv"><span>Dónde</span><span>{a.business_name}{a.address ? `, ${a.address}` : ''}{a.city ? `, ${a.city}` : ''}</span></div>
          {Number(a.price) > 0 && <div className="kv total"><span>A pagar en el negocio</span><span className="num">{money(a.price)}</span></div>}
        </div>

        <CitaActions
          token={params.token}
          canCancel={a.can_cancel}
          status={a.status}
          cancelHours={a.cancel_hours}
          gcal={gcal}
          isNew={isNew}
        />

        <div className="card">
          <h3>¿Necesitas cambiar algo?</h3>
          <p className="muted small">Escríbele al negocio por WhatsApp al <b className="num">{fmtPhone(a.business_phone)}</b>.</p>
          <div className="row">
            <a className="btn btn-wa btn-sm" target="_blank" rel="noopener"
              href={waLink(a.business_phone, `Hola, soy ${a.customer_name}. Tengo cita el ${fmtDateLong(a.starts_at)} a las ${fmtTime(a.starts_at)} (${a.service_name}).`)}>
              Escribir por WhatsApp
            </a>
            <Link className="btn btn-sm" href={`/${a.slug}`}>Reservar otra cita</Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
