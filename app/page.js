import Link from 'next/link';
import { SiteHeader, SiteFooter } from '@/components/Site';
import { supabaseServer } from '@/lib/supabase/server';
import { CATEGORIES, money } from '@/lib/format';
import { BRAND, SITE_HOST } from '@/lib/brand';

const HOST = SITE_HOST;

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }) {
  const q = (searchParams?.q || '').trim().slice(0, 60);
  const cat = CATEGORIES[searchParams?.categoria] ? searchParams.categoria : '';

  const supabase = supabaseServer();
  const [{ data: businesses }, { data: plans }] = await Promise.all([
    supabase.rpc('directory', { p_q: q.replace(/[%_]/g, ' '), p_category: cat }),
    supabase.from('plans').select('id,name,price,max_staff,description').eq('is_active', true).order('sort').order('price'),
  ]);
  const list = businesses || [];
  const filtered = Boolean(q || cat);

  return (
    <>
      <SiteHeader />
      <main>
        <section className="wrap hero">
          <div className="stack loose">
            <p className="eyebrow">Estéticas · salones · barberías · uñas</p>
            <h1>Reserva tu cita en segundos, sin esperar respuesta.</h1>
            <p className="lede">
              Elige el servicio, la profesional y la hora que te queda. La confirmación y el recordatorio te llegan por
              WhatsApp.
            </p>
            <form className="search" action="/#directorio" method="get">
              <input name="q" defaultValue={q} placeholder="Nombre del negocio o ciudad" aria-label="Buscar" />
              <select name="categoria" defaultValue={cat} aria-label="Tipo de negocio">
                <option value="">Todos los tipos</option>
                {Object.entries(CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <button className="btn btn-pri" type="submit">Buscar</button>
            </form>
          </div>
          <div className="hero-phone" aria-hidden="true">
            <div className="urlbar">{HOST}/<b>estetica-luz</b></div>
            <div className="row between">
              <b style={{ fontFamily: 'var(--f-display)', fontSize: '1.1rem' }}>Limpieza facial profunda</b>
              <span className="muted small">60 min · RD$1,800</span>
            </div>
            <div className="mini-slots">
              <span className="x">9:00</span><span>9:30</span><span className="x">10:00</span><span className="on">10:30</span>
              <span>11:00</span><span className="x">2:00</span><span>2:30</span><span>3:00</span>
            </div>
            <div className="bubble">
              Hola Carolina 👋 Tu cita quedó confirmada.{'\n'}📅 Mañana a las 10:30 am{'\n'}✨ Limpieza facial con Paola
              <small>WhatsApp ✓✓</small>
            </div>
          </div>
        </section>

        <section className="wrap section" id="directorio">
          <div className="row between">
            <div className="stack tight">
              <p className="eyebrow">{filtered ? 'Resultados' : `Negocios en ${BRAND}`}</p>
              <h2>{cat ? CATEGORIES[cat] : 'Dónde reservar'}</h2>
            </div>
            {filtered && <Link className="btn btn-sm" href="/#directorio">Ver todos</Link>}
          </div>
          {list.length ? (
            <div className="grid-auto">
              {list.map((b) => (
                <Link key={b.slug} href={`/${b.slug}`} className="card biz-card">
                  <div className="swatch" style={{ background: b.accent }} />
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    {b.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="logo" src={b.logo_url} alt="" />
                    ) : null}
                    <div className="stack tight">
                      <h3>{b.name}</h3>
                      <span className="muted small">{CATEGORIES[b.category]}{b.city ? ` · ${b.city}` : ''}</span>
                    </div>
                  </div>
                  {b.description ? <p className="muted small">{b.description.slice(0, 120)}</p> : null}
                  <span className="btn btn-sm btn-pri" style={{ alignSelf: 'flex-start', '--accent': b.accent }}>Reservar cita</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <b>{filtered ? 'No encontramos negocios con esa búsqueda.' : 'Muy pronto verás aquí los primeros negocios.'}</b>
              <span>¿Tienes una estética, salón o barbería? Registra tu negocio y recibe citas hoy mismo.</span>
              <Link className="btn btn-pri btn-sm" href="/registro">Registrar mi negocio</Link>
            </div>
          )}
        </section>

        <section className="wrap section">
          <div className="stack tight">
            <p className="eyebrow">Cómo funciona</p>
            <h2>Tres pasos y listo</h2>
          </div>
          <div className="steps">
            <div className="card"><h3>Busca</h3><p className="muted">Entra al link del negocio desde su Instagram o búscalo aquí.</p></div>
            <div className="card"><h3>Reserva</h3><p className="muted">Elige servicio, profesional y una hora libre. Solo ves horas que de verdad están disponibles.</p></div>
            <div className="card"><h3>Llega</h3><p className="muted">Te llega la confirmación y un recordatorio por WhatsApp. Si no puedes ir, cancelas desde el mismo link.</p></div>
          </div>
        </section>

        <section className="wrap section" id="negocios">
          <div className="pro-band">
            <div className="stack">
              <p className="eyebrow" style={{ color: '#F3A6C6' }}>Para negocios</p>
              <h2>Tu agenda llena, sin contestar WhatsApp a toda hora.</h2>
              <p className="muted">
                Tu negocio recibe su propio link, por ejemplo {HOST}/tu-estetica, para la bio de Instagram, tus estados y
                un código QR en el mostrador.
              </p>
              <div className="row">
                <Link className="btn btn-pri" href="/registro">Probar 15 días gratis</Link>
                <Link className="btn btn-ghost" href="/entrar" style={{ color: 'inherit', borderColor: 'currentColor' }}>Ya tengo cuenta</Link>
              </div>
            </div>
            <ul>
              <li>Reservas 24/7 con horas reales de cada profesional</li>
              <li>Confirmación y recordatorios por WhatsApp para reducir las ausencias</li>
              <li>Agenda del día por profesional, desde el celular</li>
              <li>Servicios, precios, horarios y días libres que tú controlas</li>
              <li>Reportes de ingresos, servicios más vendidos y clientas frecuentes</li>
            </ul>
          </div>
        </section>

        {plans?.length > 0 && (
          <section className="wrap section" id="planes">
            <div className="stack tight">
              <p className="eyebrow">Planes</p>
              <h2>15 días gratis. Después, según el tamaño de tu equipo.</h2>
              <p className="muted">Todos los planes incluyen todo: reservas en línea, agenda, recordatorios por WhatsApp y reportes. Sin tarjeta para empezar.</p>
            </div>
            <div className="grid3">
              {plans.map((p, i) => (
                <div key={p.id} className="card" style={i === 1 ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 1px var(--accent)' } : undefined}>
                  <h3>{p.name}</h3>
                  <p style={{ fontFamily: 'var(--f-display)', fontSize: '1.9rem', fontWeight: 800 }} className="num">
                    {money(p.price)}<span className="muted small" style={{ fontFamily: 'var(--f-body)', fontWeight: 500 }}> /mes</span>
                  </p>
                  <p className="muted">{p.max_staff === 1 ? '1 profesional' : `Hasta ${p.max_staff} profesionales`}</p>
                  {p.description && <p className="small">{p.description}</p>}
                </div>
              ))}
            </div>
            <p className="muted small">¿Más de {plans[plans.length - 1].max_staff} profesionales o varias sucursales? Escríbenos y te hacemos un precio.</p>
          </section>
        )}

        <section className="wrap section faq">
          <h2>Preguntas frecuentes</h2>
          <div>
            <details><summary>¿Cuánto cuesta reservar?</summary><p>Nada. Reservar es gratis; pagas el servicio en el negocio.</p></details>
            <details><summary>¿Necesito crear una cuenta?</summary><p>No. Solo pones tu nombre y tu WhatsApp para recibir la confirmación.</p></details>
            <details><summary>¿Cómo cancelo o cambio mi cita?</summary><p>Con el link que te llega al reservar puedes cancelar hasta unas horas antes. Para cambiarla, cancela y reserva otra hora, o escríbele al negocio.</p></details>
            <details><summary>Tengo un negocio, ¿cómo empiezo?</summary><p>Regístrate, agrega tus servicios, tu equipo y tu horario, y comparte tu link. Toma unos 10 minutos.</p></details>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
