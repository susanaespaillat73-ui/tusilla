'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { StatePill, coverage, useAdminBusinesses } from '@/components/admin/shared';
import { CATEGORIES, fmtDateShort, money } from '@/lib/format';

export default function AdminHome() {
  const supabase = supabaseBrowser();
  const [o, setO] = useState(null);
  const { list } = useAdminBusinesses();

  useEffect(() => { supabase.rpc('admin_overview').then(({ data }) => setO(data)); }, [supabase]);

  const attention = (list || []).filter((b) =>
    ['grace', 'expired'].includes(b.state) ||
    ((b.state === 'trial' || b.state === 'active') &&
      Date.parse([b.paid_until, b.trial_ends_at].filter(Boolean).sort().pop()) < Date.now() + 5 * 864e5)
  );
  const recent = (list || []).slice(0, 6);
  const idle = (list || []).filter((b) => b.state === 'trial' && Number(b.bookings_30d) === 0 && Date.parse(b.created_at) < Date.now() - 3 * 864e5);

  return (
    <>
      <h1 style={{ fontSize: 'clamp(1.6rem,3.5vw,2.2rem)' }}>Resumen</h1>
      <div className="stats">
        <div className="stat"><small>Ingreso mensual (al día)</small><b>{o ? money(o.mrr) : '–'}</b><span className="muted small">{o ? `${o.active} negocios pagando` : ''}</span></div>
        <div className="stat"><small>En prueba</small><b>{o ? o.trial : '–'}</b><span className="muted small">{o ? `${money(o.trial_value)} si todos pagan` : ''}</span></div>
        <div className="stat"><small>Cobrado últimos 30 días</small><b>{o ? money(o.collected_30d) : '–'}</b></div>
        <div className="stat"><small>Citas últimos 30 días</small><b>{o ? o.bookings_30d : '–'}</b><span className="muted small">{o ? `${o.online_30d} en línea` : ''}</span></div>
      </div>
      <div className="row small muted">
        {o && <>
          <span>{o.total} negocios en total</span>
          <span>· {o.new_7d} nuevos esta semana ({o.new_30d} en 30 días)</span>
          <span>· {o.grace} con pago pendiente</span>
          <span>· {o.expired} vencidos</span>
          <span>· {o.suspended} suspendidos</span>
        </>}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="row between" style={{ padding: '16px 18px 4px' }}>
          <h3>Requieren atención</h3>
          <span className="muted small">Pruebas o pagos que vencen en 5 días, pagos pendientes y vencidos</span>
        </div>
        {list === null ? <p className="empty" style={{ padding: 18 }}>Cargando…</p> : !attention.length ? (
          <p className="empty" style={{ padding: 18 }}>Todo al día.</p>
        ) : (
          <BizTable rows={attention} />
        )}
      </div>

      {idle.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <div className="row between" style={{ padding: '16px 18px 4px' }}>
            <h3>En prueba sin citas</h3>
            <span className="muted small">Registrados hace más de 3 días y sin reservas: conviene llamarlos</span>
          </div>
          <BizTable rows={idle} />
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div className="row between" style={{ padding: '16px 18px 4px' }}>
          <h3>Últimos registros</h3>
          <Link className="btn btn-sm" href="/admin/negocios">Ver todos</Link>
        </div>
        {list && <BizTable rows={recent} />}
      </div>
    </>
  );
}

function BizTable({ rows }) {
  return (
    <div className="tbl-wrap">
      <table>
        <thead><tr><th>Negocio</th><th>Estado</th><th>Vigencia</th><th>Plan</th><th className="r">Citas 30 d</th><th>Registro</th></tr></thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id}>
              <td><Link href={`/admin/negocios?id=${b.id}`}><b>{b.name}</b></Link><div className="muted small">{CATEGORIES[b.category]}{b.city ? ` · ${b.city}` : ''}</div></td>
              <td><StatePill state={b.state} /></td>
              <td className="small">{coverage(b)}</td>
              <td className="small">{b.plan_name}</td>
              <td className="r">{b.bookings_30d}</td>
              <td className="small">{fmtDateShort(b.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
