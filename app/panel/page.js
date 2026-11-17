'use client';
import { useCallback, useEffect, useState } from 'react';
import { usePanel, useCatalog, useToast, doesService } from '@/components/panel/PanelContext';
import {
  DOW, STATUS, addDays, capitalize, dayNum, digits, drDate, fmtDateLong, fmtPhone, fmtTime, money,
  monthShort, toISO, validPhone, waLink, weekdayOf,
} from '@/lib/format';

export default function Agenda() {
  const { supabase, biz } = usePanel();
  const { services, staff, staffServices } = useCatalog(supabase, biz.id);
  const [date, setDate] = useState(drDate());
  const [appts, setAppts] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [toast, setToast] = useToast();

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .eq('business_id', biz.id)
      .gte('starts_at', toISO(date, '00:00'))
      .lt('starts_at', toISO(addDays(date, 1), '00:00'))
      .order('starts_at');
    setAppts(data || []);
  }, [supabase, biz.id, date]);

  useEffect(() => {
    setAppts(null);
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  async function setStatus(a, status) {
    const { error } = await supabase.from('appointments').update({ status }).eq('id', a.id);
    if (error) {
      setToast(/no_overlap/.test(error.message) ? 'Esa hora ya está ocupada por otra cita.' : 'No se pudo guardar: ' + error.message);
      return;
    }
    setToast(status === 'confirmed' ? 'Cita restablecida' : `Marcada: ${STATUS[status]}`);
    load();
  }

  const today = drDate();
  const strip = Array.from({ length: 14 }, (_, i) => addDays(today, i - 3));
  const list = appts || [];
  const active = list.filter((a) => a.status !== 'cancelled');
  const income = active.filter((a) => a.status !== 'no_show').reduce((s, a) => s + Number(a.price), 0);
  const online = active.filter((a) => a.source === 'online').length;
  const wd = weekdayOf(date);
  const columns = [...staff.filter((s) => s.is_active || list.some((a) => a.staff_id === s.id))];
  const orphan = list.filter((a) => !a.staff_id || !staff.some((s) => s.id === a.staff_id));

  return (
    <>
      <div className="row between">
        <h1 style={{ fontSize: 'clamp(1.6rem,3.5vw,2.2rem)' }}>{capitalize(fmtDateLong(date))}</h1>
        <div className="row">
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Ir a fecha" style={{ width: 'auto' }} />
          <button className="btn btn-pri" onClick={() => setShowNew(true)}>Nueva cita</button>
        </div>
      </div>

      <div className="days" role="list">
        {strip.map((d) => (
          <button key={d} role="listitem" className={`dayb ${d === date ? 'on' : ''}`} onClick={() => setDate(d)}>
            <small>{d === today ? 'Hoy' : DOW[weekdayOf(d)]}</small>
            <b>{dayNum(d)}</b>
            <small>{monthShort(d)}</small>
          </button>
        ))}
      </div>

      {showNew && (
        <NewAppointment
          supabase={supabase} biz={biz} services={services.filter((s) => s.is_active)} staff={staff.filter((s) => s.is_active)}
          staffServices={staffServices} defaultDate={date}
          onClose={() => setShowNew(false)}
          onSaved={(d) => { setShowNew(false); setToast('Cita creada'); if (d === date) load(); else setDate(d); }}
        />
      )}

      <div className="stats">
        <div className="stat"><small>Citas</small><b>{appts ? active.length : '–'}</b></div>
        <div className="stat"><small>Ingreso estimado</small><b>{appts ? money(income) : '–'}</b></div>
        <div className="stat"><small>Reservadas en línea</small><b>{appts ? online : '–'}</b></div>
        <div className="stat"><small>Canceladas</small><b>{appts ? list.length - active.length : '–'}</b></div>
      </div>

      {appts === null ? <p className="muted">Cargando citas…</p> : (
        <div className="cols">
          {columns.map((st) => {
            const mine = list.filter((a) => a.staff_id === st.id);
            return (
              <div className="col" key={st.id}>
                <div className="col-h"><b>{st.name}</b>{!st.is_active && <span className="pill cancelled">Inactiva</span>}</div>
                {mine.length ? mine.map((a) => <ApptCard key={a.id} a={a} onStatus={setStatus} biz={biz} />)
                  : <p className="empty">{st.is_active ? 'Sin citas este día.' : '—'}</p>}
              </div>
            );
          })}
          {orphan.length > 0 && (
            <div className="col">
              <div className="col-h"><b>Sin asignar</b></div>
              {orphan.map((a) => <ApptCard key={a.id} a={a} onStatus={setStatus} biz={biz} />)}
            </div>
          )}
          {!columns.length && <p className="empty">Agrega a tu equipo en “Equipo y horarios” para empezar a recibir citas.</p>}
        </div>
      )}
      {wd === 0 && !list.length && <p className="muted small">Domingo: revisa si tu equipo trabaja hoy en “Equipo y horarios”.</p>}
      {toast}
    </>
  );
}

function ApptCard({ a, onStatus, biz }) {
  const msg = `Hola ${a.customer_name.split(' ')[0]}, te escribimos de ${biz.name} sobre tu cita del ${fmtDateLong(a.starts_at)} a las ${fmtTime(a.starts_at)}.`;
  return (
    <div className={`appt ${a.status}`}>
      <div className="row between"><span className="t">{fmtTime(a.starts_at)} – {fmtTime(a.ends_at)}</span><span className={`pill ${a.status}`}>{STATUS[a.status]}</span></div>
      <b>{a.customer_name}</b>
      <span className="muted small">{a.service_name} · {money(a.price)}{a.source === 'online' ? ' · en línea' : ''}</span>
      {a.notes && <span className="small">“{a.notes}”</span>}
      <a className="small num" href={waLink(a.customer_phone, msg)} target="_blank" rel="noopener">WhatsApp {fmtPhone(a.customer_phone)}</a>
      <div className="acts">
        {a.status === 'confirmed' ? (
          <>
            <button className="btn btn-sm" onClick={() => onStatus(a, 'completed')}>Atendida</button>
            <button className="btn btn-sm" onClick={() => onStatus(a, 'no_show')}>No vino</button>
            <button className="btn btn-sm btn-ghost" onClick={() => onStatus(a, 'cancelled')}>Cancelar</button>
          </>
        ) : (
          <button className="btn btn-sm btn-ghost" onClick={() => onStatus(a, 'confirmed')}>Deshacer</button>
        )}
      </div>
    </div>
  );
}

function NewAppointment({ supabase, biz, services, staff, staffServices, defaultDate, onClose, onSaved }) {
  const [f, setF] = useState({ service: services[0]?.id || '', staff: '', date: defaultDate, time: '10:00', name: '', phone: '', notes: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const svc = services.find((s) => s.id === f.service);
  const eligible = svc ? staff.filter((s) => doesService(staffServices, s.id, svc.id)) : staff;
  const staffId = eligible.some((s) => s.id === f.staff) ? f.staff : eligible[0]?.id || '';

  async function save(e) {
    e.preventDefault();
    setError('');
    if (!svc) return setError('Elige un servicio.');
    if (!staffId) return setError('Nadie del equipo hace ese servicio.');
    if (f.name.trim().length < 2) return setError('Escribe el nombre de la clienta.');
    if (!validPhone(f.phone)) return setError('El WhatsApp debe tener 10 dígitos y empezar por 809, 829 u 849.');
    setBusy(true);
    const phone = digits(f.phone);
    const { data: cust } = await supabase
      .from('customers')
      .upsert({ business_id: biz.id, name: f.name.trim(), phone }, { onConflict: 'business_id,phone' })
      .select()
      .single();
    const starts = toISO(f.date, f.time);
    const ends = new Date(Date.parse(starts) + svc.duration_min * 60000).toISOString();
    const { error: err } = await supabase.from('appointments').insert({
      business_id: biz.id, staff_id: staffId, service_id: svc.id, customer_id: cust?.id || null,
      starts_at: starts, ends_at: ends, price: svc.price, service_name: svc.name,
      customer_name: f.name.trim(), customer_phone: phone, source: 'panel', notes: f.notes.trim(),
    });
    setBusy(false);
    if (err) return setError(/no_overlap/.test(err.message) ? 'Esa profesional ya tiene una cita a esa hora.' : err.message);
    onSaved(f.date);
  }

  return (
    <form className="card sheet" onSubmit={save}>
      <div className="row between"><h3>Nueva cita</h3><button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>Cerrar</button></div>
      <div className="form-grid">
        <label className="field">Servicio
          <select id="n-svc" value={f.service} onChange={set('service')}>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.duration_min} min</option>)}
          </select>
        </label>
        <label className="field">Con
          <select id="n-staff" value={staffId} onChange={set('staff')}>
            {eligible.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="field">Día<input id="n-date" type="date" value={f.date} onChange={set('date')} required /></label>
        <label className="field">Hora<input id="n-time" type="time" step="300" value={f.time} onChange={set('time')} required /></label>
        <label className="field">Nombre de la clienta<input id="n-name" value={f.name} onChange={set('name')} required /></label>
        <label className="field">WhatsApp<input id="n-phone" value={f.phone} onChange={set('phone')} inputMode="tel" placeholder="809-555-1234" required /></label>
        <label className="field full">Nota<input id="n-notes" value={f.notes} onChange={set('notes')} /></label>
      </div>
      {error && <p className="err">{error}</p>}
      <div><button className="btn btn-pri" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar cita'}</button></div>
    </form>
  );
}
