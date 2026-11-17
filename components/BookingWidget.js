'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import {
  BOOKING_ERRORS, DOW, addDays, dayNum, drDate, fmtDateShort, fmtTime, hhmm, money, monthShort,
  validPhone, weekdayOf,
} from '@/lib/format';

const SAVED = 'tusilla-cliente';

export default function BookingWidget({ biz, services, staff, hours, staffServices, hoursBlock }) {
  const router = useRouter();
  const [svcId, setSvcId] = useState(null);
  const [staffSel, setStaffSel] = useState('any');
  const [date, setDate] = useState(null);
  const [slots, setSlots] = useState(null); // null = no cargado
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState(null); // ISO
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(SAVED) || 'null');
      if (s) { setName(s.name || ''); setPhone(s.phone || ''); }
    } catch {}
  }, []);

  const svc = services.find((s) => s.id === svcId) || null;

  const eligible = useMemo(() => {
    if (!svc) return [];
    return staff.filter((st) => {
      const rows = staffServices.filter((x) => x.staff_id === st.id);
      return rows.length === 0 || rows.some((x) => x.service_id === svc.id);
    });
  }, [svc, staff, staffServices]);

  const days = useMemo(() => {
    const today = drDate();
    const n = Math.min(biz.max_days_ahead, 45);
    return Array.from({ length: n + 1 }, (_, i) => addDays(today, i));
  }, [biz.max_days_ahead]);

  const pool = staffSel === 'any' ? eligible : eligible.filter((s) => s.id === staffSel);
  const worksOn = (d) => {
    const wd = weekdayOf(d);
    return pool.some((st) => hours.some((h) => h.staff_id === st.id && h.weekday === wd));
  };

  useEffect(() => {
    if (!svc || !date) { setSlots(null); return; }
    let cancelled = false;
    setLoading(true);
    supabaseBrowser()
      .rpc('get_available_slots', {
        p_slug: biz.slug, p_service: svc.id, p_date: date, p_staff: staffSel === 'any' ? null : staffSel,
      })
      .then(({ data, error: e }) => {
        if (cancelled) return;
        setLoading(false);
        if (e) { setSlots([]); setError('No pudimos cargar las horas. Revisa tu conexión e intenta de nuevo.'); return; }
        const seen = new Set();
        setSlots((data || []).filter((r) => (seen.has(r.starts_at) ? false : seen.add(r.starts_at))).map((r) => r.starts_at));
      });
    return () => { cancelled = true; };
  }, [svc, date, staffSel, biz.slug, reload]);

  function pickService(id) {
    setSvcId(id); setStaffSel('any'); setDate(null); setTime(null); setError('');
  }
  function pickStaff(id) {
    setStaffSel(id); setDate(null); setTime(null); setError('');
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (name.trim().length < 3) return setError(BOOKING_ERRORS.invalid_name);
    if (!validPhone(phone)) return setError(BOOKING_ERRORS.invalid_phone);
    setSending(true);
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: biz.slug, service_id: svc.id, staff_id: staffSel === 'any' ? null : staffSel,
          starts_at: time, name: name.trim(), phone, notes: notes.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(BOOKING_ERRORS[json.error] || 'No pudimos reservar. Intenta de nuevo en un momento.');
        if (json.error === 'slot_taken') { setTime(null); setReload((n) => n + 1); }
        setSending(false);
        return;
      }
      try { localStorage.setItem(SAVED, JSON.stringify({ name: name.trim(), phone })); } catch {}
      router.push(`/cita/${json.token}?nueva=1`);
    } catch {
      setError('Sin conexión. Revisa tu internet e intenta de nuevo.');
      setSending(false);
    }
  }

  const groups = [
    ['Mañana', (t) => t < '12:00'],
    ['Tarde', (t) => t >= '12:00' && t < '17:00'],
    ['Noche', (t) => t >= '17:00'],
  ];
  const staffName = staffSel === 'any' ? 'La primera disponible' : staff.find((s) => s.id === staffSel)?.name;

  return (
    <div className="book">
      <div className="stack" style={{ gap: 14 }}>
        <section className="step">
          <div className="step-h"><span className="n">01</span><h3>Elige el servicio</h3></div>
          <div className="svc-list">
            {services.map((s) => (
              <button key={s.id} type="button" className={`opt ${svcId === s.id ? 'on' : ''}`} onClick={() => pickService(s.id)} aria-pressed={svcId === s.id}>
                <span className="stack tight" style={{ gap: 2 }}>
                  <b>{s.name}</b>
                  <span className="meta">{s.duration_min} min{s.description ? ` · ${s.description}` : ''}</span>
                </span>
                <span className="num" style={{ fontWeight: 700 }}>{Number(s.price) > 0 ? money(s.price) : 'Consultar'}</span>
              </button>
            ))}
          </div>
        </section>

        <section className={`step ${svc ? '' : 'off'}`}>
          <div className="step-h"><span className="n">02</span><h3>¿Con quién?</h3></div>
          {svc ? (
            <div className="chips">
              {eligible.length > 1 && (
                <button type="button" className={`chip ${staffSel === 'any' ? 'on' : ''}`} onClick={() => pickStaff('any')}>La primera disponible</button>
              )}
              {eligible.map((st) => (
                <button type="button" key={st.id} className={`chip ${staffSel === st.id || (eligible.length === 1 && staffSel === 'any') ? 'on' : ''}`} onClick={() => pickStaff(st.id)}>
                  {st.name}
                </button>
              ))}
              {!eligible.length && <p className="muted">Nadie del equipo tiene este servicio disponible por ahora.</p>}
            </div>
          ) : <p className="muted">Primero elige un servicio.</p>}
        </section>

        <section className={`step ${svc ? '' : 'off'}`}>
          <div className="step-h"><span className="n">03</span><h3>Día</h3></div>
          {svc ? (
            <div className="days" role="list">
              {days.map((d, i) => {
                const ok = worksOn(d);
                return (
                  <button type="button" key={d} role="listitem" className={`dayb ${date === d ? 'on' : ''}`} disabled={!ok}
                    onClick={() => { setDate(d); setTime(null); setError(''); }} aria-label={fmtDateShort(d)}>
                    <small>{i === 0 ? 'Hoy' : i === 1 ? 'Mañ.' : DOW[weekdayOf(d)]}</small>
                    <b>{dayNum(d)}</b>
                    <small>{monthShort(d)}</small>
                  </button>
                );
              })}
            </div>
          ) : <p className="muted">Primero elige un servicio.</p>}
        </section>

        <section className={`step ${date ? '' : 'off'}`}>
          <div className="step-h"><span className="n">04</span><h3>Hora</h3></div>
          {!date ? <p className="muted">Elige un día para ver las horas libres.</p>
            : loading || slots === null ? (
              <div className="slots">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton" />)}</div>
            ) : !slots.length ? (
              <p className="muted">No quedan horas libres ese día. Prueba otro día{eligible.length > 1 ? ' u otra profesional' : ''}.</p>
            ) : groups.map(([g, f]) => {
              const ts = slots.filter((s) => f(hhmm(s)));
              if (!ts.length) return null;
              return (
                <div key={g} className="stack tight">
                  <span className="slot-g">{g}</span>
                  <div className="slots">
                    {ts.map((s) => (
                      <button type="button" key={s} className={`slot ${time === s ? 'on' : ''}`} onClick={() => { setTime(s); setError(''); }}>
                        {fmtTime(s)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
        </section>

        <form className={`step ${time ? '' : 'off'}`} onSubmit={submit}>
          <div className="step-h"><span className="n">05</span><h3>Tus datos</h3></div>
          <div className="form-grid">
            <label className="field">Nombre y apellido
              <input id="bk-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Ej. Carolina Jiménez" disabled={!time} />
            </label>
            <label className="field">WhatsApp
              <input id="bk-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="809-555-1234" disabled={!time} />
            </label>
            <label className="field full">Nota para el negocio <span className="hint">Opcional: alergias, si es tu primera vez, etc.</span>
              <input id="bk-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} disabled={!time} />
            </label>
          </div>
          <p className="muted small">Te enviaremos la confirmación por WhatsApp con un link para cancelar si lo necesitas.</p>
          {error && <p className="err" role="alert">{error}</p>}
          <div><button className="btn btn-pri" type="submit" disabled={!time || sending}>{sending ? 'Reservando…' : 'Confirmar cita'}</button></div>
        </form>
      </div>

      <aside className="stack">
        <div className="summary">
          <h3>Tu cita</h3>
          <div className="kv"><span>Servicio</span><span>{svc ? svc.name : '—'}</span></div>
          <div className="kv"><span>Duración</span><span>{svc ? `${svc.duration_min} min` : '—'}</span></div>
          <div className="kv"><span>Con</span><span>{svc ? (eligible.length === 1 ? eligible[0].name : staffName) : '—'}</span></div>
          <div className="kv"><span>Fecha</span><span>{date ? fmtDateShort(date) : '—'}</span></div>
          <div className="kv"><span>Hora</span><span>{time ? fmtTime(time) : '—'}</span></div>
          <div className="kv total"><span>Total</span><span className="num">{svc ? (Number(svc.price) > 0 ? money(svc.price) : 'Consultar') : '—'}</span></div>
          <p className="muted small">
            Pagas en el negocio.{biz.cancel_hours ? ` Puedes cancelar en línea hasta ${biz.cancel_hours} h antes.` : ''}
          </p>
        </div>
        <div className="card">
          <h3>Horario</h3>
          {hoursBlock}
        </div>
      </aside>
    </div>
  );
}
