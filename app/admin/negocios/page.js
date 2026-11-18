'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { StatePill, coverage, useAdminBusinesses } from '@/components/admin/shared';
import { useToast } from '@/components/panel/PanelContext';
import { ACCOUNT_STATE, CATEGORIES, drDate, fmtDateShort, fmtPhone, money, toISO, waLink } from '@/lib/format';
import { BRAND } from '@/lib/brand';

const FILTERS = [['all', 'Todos'], ['trial', 'En prueba'], ['active', 'Al día'], ['grace', 'Pago pendiente'], ['expired', 'Vencidos'], ['suspended', 'Suspendidos']];

function Negocios() {
  const params = useSearchParams();
  const { list, error, reload, supabase } = useAdminBusinesses();
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(params.get('id'));
  const [plans, setPlans] = useState([]);
  const [toast, setToast] = useToast();

  useEffect(() => { supabase.from('plans').select('*').order('sort').then(({ data }) => setPlans(data || [])); }, [supabase]);

  const rows = (list || []).filter((b) =>
    (filter === 'all' || b.state === filter) &&
    (!q || `${b.name} ${b.slug} ${b.city} ${b.owner_email} ${b.phone}`.toLowerCase().includes(q.toLowerCase()))
  );
  const count = (k) => (list || []).filter((b) => k === 'all' || b.state === k).length;

  return (
    <>
      <div className="row between">
        <h1 style={{ fontSize: 'clamp(1.6rem,3.5vw,2.2rem)' }}>Negocios</h1>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, correo, ciudad o teléfono" aria-label="Buscar" style={{ maxWidth: 360 }} />
      </div>
      <div className="chips">
        {FILTERS.map(([k, l]) => (
          <button key={k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{l} · {list ? count(k) : '–'}</button>
        ))}
      </div>
      {error && <p className="err">{error}</p>}

      {list === null ? <p className="muted">Cargando…</p> : !rows.length ? <p className="empty">No hay negocios en esta lista.</p> : (
        <div className="stack">
          {rows.map((b) => (
            <div className="card" key={b.id} style={open === b.id ? { borderColor: 'var(--accent)' } : undefined}>
              <div className="row between" style={{ cursor: 'pointer' }} onClick={() => setOpen(open === b.id ? null : b.id)}>
                <div className="stack tight">
                  <h3>{b.name} {!b.is_published && <span className="pill cancelled">Página oculta</span>}</h3>
                  <span className="muted small">{CATEGORIES[b.category]}{b.city ? ` · ${b.city}` : ''} · {b.owner_email} · registrado {fmtDateShort(b.created_at)}</span>
                </div>
                <div className="row">
                  <StatePill state={b.state} />
                  <span className="small">{coverage(b)}</span>
                  <span className="small muted">{b.plan_name} · {b.staff_active} prof. · {b.bookings_30d} citas/30 d</span>
                  <button className="btn btn-sm" type="button">{open === b.id ? 'Cerrar' : 'Gestionar'}</button>
                </div>
              </div>
              {open === b.id && (
                <Detail key={b.id} b={b} plans={plans} supabase={supabase}
                  onSaved={(m) => { setToast(m); reload(); }} />
              )}
            </div>
          ))}
        </div>
      )}
      {toast}
    </>
  );
}

const asDate = (iso) => (iso ? drDate(new Date(iso)) : '');

function Detail({ b, plans, supabase, onSaved }) {
  const [f, setF] = useState({
    plan_id: b.plan_id, trial: asDate(b.trial_ends_at), paid: asDate(b.paid_until), suspended: b.suspended, notes: b.notes,
  });
  const plan = plans.find((p) => p.id === f.plan_id);
  const [pay, setPay] = useState({ months: 1, amount: plan ? Number(plan.price) : Number(b.plan_price), method: 'transferencia', note: '' });
  const [payments, setPayments] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from('payments').select('*').eq('business_id', b.id).order('created_at', { ascending: false }).then(({ data }) => setPayments(data || []));
  }, [supabase, b.id]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function save() {
    setError(''); setBusy(true);
    const { error: e1 } = await supabase.from('businesses').update({
      plan_id: f.plan_id,
      trial_ends_at: f.trial ? toISO(f.trial, '23:59') : null,
      paid_until: f.paid ? toISO(f.paid, '23:59') : null,
      suspended: f.suspended,
    }).eq('id', b.id);
    const { error: e2 } = await supabase.from('business_admin_notes').upsert({ business_id: b.id, notes: f.notes, updated_at: new Date().toISOString() });
    setBusy(false);
    if (e1 || e2) return setError((e1 || e2).message);
    onSaved(`${b.name}: cambios guardados`);
  }

  async function recordPayment(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    const { data, error: err } = await supabase.rpc('admin_record_payment', {
      p_business: b.id, p_amount: Number(pay.amount), p_months: Number(pay.months), p_method: pay.method, p_note: pay.note,
    });
    setBusy(false);
    if (err) return setError(err.message);
    onSaved(`Pago registrado. ${b.name} queda al día hasta el ${fmtDateShort(data.paid_until)}`);
  }

  const reminder = `Hola, te escribimos de ${BRAND}. ${
    b.state === 'trial' ? `Tu prueba gratis de ${b.name} termina el ${fmtDateShort(b.trial_ends_at)}.` :
    b.state === 'active' ? `El plan de ${b.name} se renueva el ${fmtDateShort(b.paid_until)}.` :
    `La cuenta de ${b.name} tiene el pago pendiente y la página dejará de recibir reservas.`
  } El plan ${plan?.name || b.plan_name} cuesta ${money(plan?.price ?? b.plan_price)} al mes. ¿Te paso los datos para el pago?`;

  return (
    <div className="stack loose" style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
      <div className="row small">
        <a className="btn btn-sm btn-wa" href={waLink(b.phone, reminder)} target="_blank" rel="noopener">WhatsApp {fmtPhone(b.phone)}</a>
        <Link className="btn btn-sm" href={`/${b.slug}`} target="_blank">Ver su página</Link>
        <span className="muted">Servicios: {b.services_active} · Próximas citas: {b.upcoming} · En línea 30 d: {b.online_30d} · Última reserva: {b.last_booking_at ? fmtDateShort(b.last_booking_at) : 'nunca'} · Total pagado: {money(b.total_paid)}</span>
      </div>

      <div className="two">
        <div className="stack">
          <h3>Cuenta</h3>
          <div className="form-grid">
            <label className="field">Plan
              <select value={f.plan_id} onChange={set('plan_id')}>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name} · {money(p.price)} · hasta {p.max_staff}</option>)}
              </select>
            </label>
            <label className="field">Prueba gratis hasta
              <input type="date" value={f.trial} onChange={set('trial')} />
            </label>
            <label className="field">Pagado hasta
              <input type="date" value={f.paid} onChange={set('paid')} />
            </label>
            <label className="check-line" style={{ alignSelf: 'end', paddingBottom: 10 }}>
              <input type="checkbox" checked={f.suspended} onChange={set('suspended')} /> Suspendido (su página no recibe reservas)
            </label>
            <label className="field full">Notas internas <span className="hint">Solo las ves tú</span>
              <textarea value={f.notes} onChange={set('notes')} style={{ minHeight: 70 }} />
            </label>
          </div>
          <div><button className="btn btn-pri btn-sm" onClick={save} disabled={busy}>Guardar cuenta</button></div>
          <p className="muted small">Estado actual: {ACCOUNT_STATE[b.state]}. Para dar más días de prueba, cambia la fecha de “Prueba gratis hasta”.</p>
        </div>

        <form className="stack" onSubmit={recordPayment}>
          <h3>Registrar pago</h3>
          <div className="form-grid">
            <label className="field">Meses
              <select value={pay.months} onChange={(e) => {
                const m = Number(e.target.value);
                const base = Number(plan?.price ?? b.plan_price);
                setPay({ ...pay, months: m, amount: m === 12 ? base * 10 : base * m });
              }}>
                {[1, 2, 3, 6, 12].map((m) => <option key={m} value={m}>{m} {m === 1 ? 'mes' : 'meses'}{m === 12 ? ' (paga 10)' : ''}</option>)}
              </select>
            </label>
            <label className="field">Monto (RD$)
              <input type="number" min="0" step="10" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
            </label>
            <label className="field">Forma de pago
              <select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
                <option value="transferencia">Transferencia</option>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="otro">Otro</option>
              </select>
            </label>
            <label className="field">Nota <span className="hint">Ej. referencia del depósito</span>
              <input value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} />
            </label>
          </div>
          <div><button className="btn btn-pri btn-sm" type="submit" disabled={busy}>Registrar pago</button></div>
          <p className="muted small">El periodo pagado empieza cuando termina lo que ya tiene cubierto (prueba o pago anterior), así nadie pierde días.</p>
        </form>
      </div>

      {error && <p className="err">{error}</p>}

      <div className="stack tight">
        <h3>Historial de pagos</h3>
        {payments === null ? <p className="muted small">Cargando…</p> : !payments.length ? <p className="empty">Sin pagos todavía.</p> : (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Fecha</th><th className="r">Monto</th><th>Meses</th><th>Forma</th><th>Cubre</th><th>Nota</th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{fmtDateShort(p.created_at)}</td>
                    <td className="r">{money(p.amount)}</td>
                    <td>{p.months}</td>
                    <td>{p.method}</td>
                    <td className="small">{fmtDateShort(p.period_start)} – {fmtDateShort(p.period_end)}</td>
                    <td className="small">{p.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<p className="muted">Cargando…</p>}><Negocios /></Suspense>;
}
