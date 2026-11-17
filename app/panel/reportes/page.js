'use client';
import { useEffect, useState } from 'react';
import { usePanel } from '@/components/panel/PanelContext';
import { addDays, dayNum, drDate, fmtDateShort, fmtPhone, money, toISO } from '@/lib/format';

const RANGES = [[7, '7 días'], [30, '30 días'], [90, '90 días']];

export default function Reportes() {
  const { supabase, biz } = usePanel();
  const [range, setRange] = useState(30);
  const [rows, setRows] = useState(null);
  const [upcoming, setUpcoming] = useState(null);
  const [staff, setStaff] = useState({});

  useEffect(() => {
    setRows(null);
    const from = toISO(addDays(drDate(), -(range - 1)), '00:00');
    const now = new Date().toISOString();
    (async () => {
      const [{ data }, { data: up }, { data: st }] = await Promise.all([
        supabase.from('appointments').select('id,starts_at,status,price,service_name,staff_id,customer_name,customer_phone,source')
          .eq('business_id', biz.id).gte('starts_at', from).lte('starts_at', now).limit(5000),
        supabase.from('appointments').select('id,price', { count: 'exact' }).eq('business_id', biz.id).eq('status', 'confirmed')
          .gt('starts_at', now).lte('starts_at', new Date(Date.now() + 7 * 864e5).toISOString()),
        supabase.from('staff').select('id,name').eq('business_id', biz.id),
      ]);
      setStaff(Object.fromEntries((st || []).map((s) => [s.id, s.name])));
      setRows(data || []);
      setUpcoming(up || []);
    })();
  }, [supabase, biz.id, range]);

  if (!rows) return <><Header range={range} setRange={setRange} /><p className="muted">Cargando…</p></>;

  const done = rows.filter((r) => r.status === 'completed');
  const noShow = rows.filter((r) => r.status === 'no_show');
  const pendingMark = rows.filter((r) => r.status === 'confirmed');
  const revenue = done.reduce((s, r) => s + Number(r.price), 0);
  const attendedBase = done.length + noShow.length;
  const onlineShare = rows.length ? Math.round((rows.filter((r) => r.source === 'online').length / rows.length) * 100) : 0;

  // Ingresos por día (o por semana en 90 días)
  const today = drDate();
  const days = Array.from({ length: range }, (_, i) => addDays(today, i - range + 1));
  const perDay = Object.fromEntries(days.map((d) => [d, 0]));
  for (const r of done) { const d = drDate(new Date(r.starts_at)); if (d in perDay) perDay[d] += Number(r.price); }
  let buckets = days.map((d) => ({ label: `${dayNum(d)}/${Number(d.slice(5, 7))}`, key: d, v: perDay[d] }));
  if (range > 31) {
    const w = [];
    for (let i = 0; i < buckets.length; i += 7) {
      const chunk = buckets.slice(i, i + 7);
      w.push({ label: chunk[0].label, key: chunk[0].key, v: chunk.reduce((s, b) => s + b.v, 0) });
    }
    buckets = w;
  }

  const group = (keyFn) => {
    const m = {};
    for (const r of done) { const k = keyFn(r); m[k] = m[k] || { n: 0, v: 0 }; m[k].n++; m[k].v += Number(r.price); }
    return Object.entries(m).map(([k, x]) => ({ k, ...x })).sort((a, b) => b.v - a.v);
  };
  const byStaff = group((r) => staff[r.staff_id] || 'Sin asignar');
  const bySvc = group((r) => r.service_name);
  const clients = {};
  for (const r of done) {
    const c = clients[r.customer_phone] || (clients[r.customer_phone] = { name: r.customer_name, phone: r.customer_phone, n: 0, v: 0, last: '' });
    c.n++; c.v += Number(r.price); if (r.starts_at > c.last) c.last = r.starts_at;
  }
  const top = Object.values(clients).sort((a, b) => b.n - a.n || b.v - a.v).slice(0, 8);
  const maxStaff = Math.max(1, ...byStaff.map((x) => x.v));

  return (
    <>
      <Header range={range} setRange={setRange} />
      <div className="stats">
        <div className="stat"><small>Ingresos</small><b>{money(revenue)}</b></div>
        <div className="stat"><small>Clientas atendidas</small><b>{done.length}</b></div>
        <div className="stat"><small>Ticket promedio</small><b>{money(done.length ? revenue / done.length : 0)}</b></div>
        <div className="stat"><small>No vinieron</small><b>{attendedBase ? Math.round((noShow.length / attendedBase) * 100) : 0}%</b></div>
      </div>
      <div className="row small muted">
        <span>Próximos 7 días: <b className="num">{upcoming?.length || 0}</b> citas ({money((upcoming || []).reduce((s, r) => s + Number(r.price), 0))} estimado)</span>
        <span>· {onlineShare}% reservadas en línea</span>
        {pendingMark.length > 0 && <span>· {pendingMark.length} citas pasadas sin marcar como atendidas en la Agenda</span>}
      </div>

      <div className="card">
        <h3>Ingresos por {range > 31 ? 'semana' : 'día'}</h3>
        <Chart buckets={buckets} />
      </div>

      <div className="two">
        <div className="card">
          <h3>Por profesional</h3>
          {byStaff.length ? byStaff.map((x) => (
            <div className="bar-row" key={x.k}>
              <span>{x.k}</span>
              <span className="bar"><i style={{ width: `${(x.v / maxStaff) * 100}%` }} /></span>
              <span className="num" style={{ fontWeight: 600 }}>{money(x.v)} <span className="muted" style={{ fontWeight: 400 }}>· {x.n}</span></span>
            </div>
          )) : <p className="empty">Sin citas atendidas en este periodo.</p>}
        </div>
        <div className="card" style={{ padding: 0 }}>
          <h3 style={{ padding: '18px 18px 0' }}>Servicios más vendidos</h3>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Servicio</th><th className="r">Veces</th><th className="r">Ingresos</th></tr></thead>
              <tbody>{bySvc.slice(0, 10).map((x) => <tr key={x.k}><td>{x.k}</td><td className="r">{x.n}</td><td className="r">{money(x.v)}</td></tr>)}</tbody>
            </table>
          </div>
          {!bySvc.length && <p className="empty" style={{ padding: '0 18px 18px' }}>Sin datos todavía.</p>}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <h3 style={{ padding: '18px 18px 0' }}>Clientas frecuentes</h3>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Clienta</th><th>WhatsApp</th><th className="r">Visitas</th><th className="r">Gastado</th><th>Última visita</th></tr></thead>
            <tbody>{top.map((c) => (
              <tr key={c.phone}><td>{c.name}</td><td className="num">{fmtPhone(c.phone)}</td><td className="r">{c.n}</td><td className="r">{money(c.v)}</td><td>{fmtDateShort(c.last)}</td></tr>
            ))}</tbody>
          </table>
        </div>
        {!top.length && <p className="empty" style={{ padding: '0 18px 18px' }}>Aparecerán cuando marques citas como atendidas.</p>}
      </div>
    </>
  );
}

function Header({ range, setRange }) {
  return (
    <div className="row between">
      <div className="stack tight">
        <h1 style={{ fontSize: 'clamp(1.6rem,3.5vw,2.2rem)' }}>Reportes</h1>
        <p className="muted">Cuentan las citas que marcas como “Atendida” en la Agenda.</p>
      </div>
      <div className="chips">
        {RANGES.map(([n, l]) => <button key={n} className={`chip ${range === n ? 'on' : ''}`} onClick={() => setRange(n)}>{l}</button>)}
      </div>
    </div>
  );
}

function niceMax(v) {
  if (v <= 0) return 1000;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

function Chart({ buckets }) {
  const W = 720, H = 240, L = 56, R = 10, T = 12, B = 30;
  const max = niceMax(Math.max(...buckets.map((b) => b.v)));
  const n = buckets.length;
  const cw = (W - L - R) / n;
  const bw = Math.max(3, cw * 0.62);
  const every = n <= 10 ? 1 : n <= 16 ? 2 : 5;
  const fmtK = (t) => (t >= 1000 ? `${(t / 1000).toLocaleString('en-US')}k` : String(t));
  return (
    <div className="tbl-wrap">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Ingresos por periodo" style={{ minWidth: 420 }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = T + (H - T - B) * (1 - f);
          return (
            <g key={f}>
              <line className="grid-l" x1={L} x2={W - R} y1={y} y2={y} />
              <text x={L - 8} y={y + 4} textAnchor="end">{fmtK(f * max)}</text>
            </g>
          );
        })}
        {buckets.map((b, i) => {
          const h = ((H - T - B) * b.v) / max;
          const x = L + i * cw + (cw - bw) / 2;
          return (
            <g key={b.key}>
              <rect className="bar-f" x={x} y={H - B - h} width={bw} height={Math.max(h, b.v ? 1 : 0)} rx={3}>
                <title>{`${b.label}: ${money(b.v)}`}</title>
              </rect>
              {(n - 1 - i) % every === 0 && <text x={x + bw / 2} y={H - 10} textAnchor="middle">{b.label}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
