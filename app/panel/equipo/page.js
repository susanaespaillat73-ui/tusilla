'use client';
import { useEffect, useState } from 'react';
import { usePanel, useCatalog, useToast } from '@/components/panel/PanelContext';
import { DOW_LONG, WEEK_ORDER, drDate, fmtDateShort, fmtTime, timeShort, toISO } from '@/lib/format';

export default function Equipo() {
  const { supabase, biz } = usePanel();
  const { services, staff, staffServices, loaded, reload } = useCatalog(supabase, biz.id);
  const [open, setOpen] = useState(null);
  const [toast, setToast] = useToast();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');

  async function add(e) {
    e.preventDefault();
    if (newName.trim().length < 2) return;
    const { data, error } = await supabase.from('staff')
      .insert({ business_id: biz.id, name: newName.trim(), role: newRole.trim(), sort: staff.length })
      .select().single();
    if (error) return setToast(error.message);
    await supabase.from('working_hours').insert([1, 2, 3, 4, 5, 6].map((d) => ({ staff_id: data.id, weekday: d, start_time: '09:00', end_time: '18:00' })));
    setNewName(''); setNewRole(''); setAdding(false); setOpen(data.id);
    setToast(`${data.name} agregada. Revisa su horario.`);
    reload();
  }

  return (
    <>
      <div className="row between">
        <div className="stack tight">
          <h1 style={{ fontSize: 'clamp(1.6rem,3.5vw,2.2rem)' }}>Equipo y horarios</h1>
          <p className="muted">Cada profesional tiene sus servicios, su horario semanal y sus días libres. Las clientas solo ven horas dentro de ese horario.</p>
        </div>
        <button className="btn btn-pri" onClick={() => setAdding(true)}>Agregar profesional</button>
      </div>

      {adding && (
        <form className="card sheet" onSubmit={add}>
          <h3>Nueva profesional</h3>
          <div className="form-grid">
            <label className="field">Nombre<input id="st-new-name" value={newName} onChange={(e) => setNewName(e.target.value)} required /></label>
            <label className="field">Rol <span className="hint">Ej. Cosmetóloga, manicurista</span><input id="st-new-role" value={newRole} onChange={(e) => setNewRole(e.target.value)} /></label>
          </div>
          <p className="muted small">Empieza con horario de lunes a sábado, 9:00 am a 6:00 pm. Lo ajustas después.</p>
          <div className="row"><button className="btn btn-pri btn-sm" type="submit">Agregar</button><button className="btn btn-sm btn-ghost" type="button" onClick={() => setAdding(false)}>Cancelar</button></div>
        </form>
      )}

      {!loaded ? <p className="muted">Cargando…</p> : (
        <div className="stack">
          {staff.map((st) => (
            <div className="card" key={st.id}>
              <div className="row between">
                <div className="stack tight">
                  <h3>{st.name} {!st.is_active && <span className="pill cancelled">Inactiva</span>}</h3>
                  <span className="muted small">{st.role || 'Sin rol'} · {countServices(staffServices, st.id, services)}</span>
                </div>
                <button className="btn btn-sm" onClick={() => setOpen(open === st.id ? null : st.id)}>{open === st.id ? 'Cerrar' : 'Editar'}</button>
              </div>
              {open === st.id && (
                <StaffEditor key={st.id} supabase={supabase} st={st} services={services} staffServices={staffServices}
                  canDelete={staff.length > 1}
                  onSaved={(m) => { setToast(m); reload(); }}
                  onDeleted={() => { setOpen(null); setToast('Profesional eliminada'); reload(); }} />
              )}
            </div>
          ))}
        </div>
      )}
      {toast}
    </>
  );
}

function countServices(ss, id, services) {
  const n = ss.filter((x) => x.staff_id === id).length;
  return n === 0 ? 'Todos los servicios' : `${n} de ${services.length} servicios`;
}

const emptyDay = { on: false, start: '09:00', end: '18:00', brk: false, bStart: '13:00', bEnd: '14:00' };

function StaffEditor({ supabase, st, services, staffServices, canDelete, onSaved, onDeleted }) {
  const [info, setInfo] = useState({ name: st.name, role: st.role, is_active: st.is_active });
  const mine = staffServices.filter((x) => x.staff_id === st.id).map((x) => x.service_id);
  const [svcSel, setSvcSel] = useState(mine.length ? mine : services.map((s) => s.id));
  const [week, setWeek] = useState(null);
  const [offs, setOffs] = useState([]);
  const [off, setOff] = useState({ date: drDate(), allDay: true, from: '09:00', to: '13:00', reason: '' });
  const [error, setError] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: wh }, { data: to }] = await Promise.all([
        supabase.from('working_hours').select('*').eq('staff_id', st.id).order('start_time'),
        supabase.from('time_off').select('*').eq('staff_id', st.id).gte('ends_at', new Date().toISOString()).order('starts_at'),
      ]);
      const w = {};
      for (const d of [0, 1, 2, 3, 4, 5, 6]) {
        const rows = (wh || []).filter((r) => r.weekday === d);
        if (!rows.length) { w[d] = { ...emptyDay }; continue; }
        const first = rows[0], last = rows[rows.length - 1];
        w[d] = {
          on: true, start: timeShort(first.start_time), end: timeShort(last.end_time),
          brk: rows.length > 1, bStart: rows.length > 1 ? timeShort(first.end_time) : '13:00', bEnd: rows.length > 1 ? timeShort(rows[1].start_time) : '14:00',
        };
      }
      setWeek(w);
      setOffs(to || []);
    })();
  }, [supabase, st.id]);

  const setDay = (d, k, v) => setWeek({ ...week, [d]: { ...week[d], [k]: v } });

  async function save() {
    setError('');
    if (info.name.trim().length < 2) return setError('Escribe el nombre.');
    if (!svcSel.length) return setError('Marca al menos un servicio.');
    const rows = [];
    for (const d of Object.keys(week)) {
      const w = week[d];
      if (!w.on) continue;
      if (w.end <= w.start) return setError(`${DOW_LONG[d]}: la salida debe ser después de la entrada.`);
      if (w.brk) {
        if (!(w.start < w.bStart && w.bStart < w.bEnd && w.bEnd < w.end)) return setError(`${DOW_LONG[d]}: el descanso debe quedar dentro del horario.`);
        rows.push({ staff_id: st.id, weekday: Number(d), start_time: w.start, end_time: w.bStart });
        rows.push({ staff_id: st.id, weekday: Number(d), start_time: w.bEnd, end_time: w.end });
      } else rows.push({ staff_id: st.id, weekday: Number(d), start_time: w.start, end_time: w.end });
    }
    const e1 = (await supabase.from('staff').update({ name: info.name.trim(), role: info.role.trim(), is_active: info.is_active }).eq('id', st.id)).error;
    const e2 = (await supabase.from('working_hours').delete().eq('staff_id', st.id)).error;
    const e3 = rows.length ? (await supabase.from('working_hours').insert(rows)).error : null;
    const e4 = (await supabase.from('staff_services').delete().eq('staff_id', st.id)).error;
    const all = svcSel.length === services.length;
    const e5 = !all ? (await supabase.from('staff_services').insert(svcSel.map((id) => ({ staff_id: st.id, service_id: id })))).error : null;
    const err = e1 || e2 || e3 || e4 || e5;
    if (err) return setError('No se pudo guardar: ' + err.message);
    onSaved(`Cambios de ${info.name.trim()} guardados`);
  }

  async function addOff(e) {
    e.preventDefault();
    const starts = toISO(off.date, off.allDay ? '00:00' : off.from);
    const ends = off.allDay ? toISO(off.date, '23:59') : toISO(off.date, off.to);
    if (Date.parse(ends) <= Date.parse(starts)) return setError('El bloqueo debe terminar después de empezar.');
    const { data, error: err } = await supabase.from('time_off').insert({ staff_id: st.id, starts_at: starts, ends_at: ends, reason: off.reason.trim() }).select().single();
    if (err) return setError(err.message);
    setOffs([...offs, data].sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
    setOff({ ...off, reason: '' });
  }
  async function removeOff(id) {
    await supabase.from('time_off').delete().eq('id', id);
    setOffs(offs.filter((o) => o.id !== id));
  }
  async function remove() {
    if (!confirmDel) return setConfirmDel(true);
    const { error: err } = await supabase.from('staff').delete().eq('id', st.id);
    if (err) return setError(err.message);
    onDeleted();
  }

  if (!week) return <p className="muted">Cargando horario…</p>;

  return (
    <div className="stack loose" style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
      <div className="form-grid">
        <label className="field">Nombre<input id={`st-name-${st.id}`} value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} /></label>
        <label className="field">Rol<input id={`st-role-${st.id}`} value={info.role} onChange={(e) => setInfo({ ...info, role: e.target.value })} /></label>
        <label className="check-line full"><input type="checkbox" checked={info.is_active} onChange={(e) => setInfo({ ...info, is_active: e.target.checked })} /> Recibe citas en línea</label>
      </div>

      <div className="stack tight">
        <h3>Servicios que hace</h3>
        <div className="chips">
          {services.map((s) => {
            const on = svcSel.includes(s.id);
            return (
              <button key={s.id} type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on}
                onClick={() => setSvcSel(on ? svcSel.filter((x) => x !== s.id) : [...svcSel, s.id])}>{s.name}</button>
            );
          })}
        </div>
      </div>

      <div className="stack tight">
        <h3>Horario semanal</h3>
        <div className="week">
          {WEEK_ORDER.map((d) => {
            const w = week[d];
            return (
              <FragmentDay key={d} label={DOW_LONG[d]}>
                <label className="check-line"><input type="checkbox" checked={w.on} onChange={(e) => setDay(d, 'on', e.target.checked)} />{w.on ? '' : 'Libre'}</label>
                {w.on && (
                  <>
                    <input type="time" step="900" value={w.start} onChange={(e) => setDay(d, 'start', e.target.value)} aria-label={`${DOW_LONG[d]} entrada`} />
                    <span className="muted">a</span>
                    <input type="time" step="900" value={w.end} onChange={(e) => setDay(d, 'end', e.target.value)} aria-label={`${DOW_LONG[d]} salida`} />
                    <label className="check-line small"><input type="checkbox" checked={w.brk} onChange={(e) => setDay(d, 'brk', e.target.checked)} />Descanso</label>
                    {w.brk && (
                      <>
                        <input type="time" step="900" value={w.bStart} onChange={(e) => setDay(d, 'bStart', e.target.value)} aria-label="Inicio del descanso" />
                        <span className="muted">a</span>
                        <input type="time" step="900" value={w.bEnd} onChange={(e) => setDay(d, 'bEnd', e.target.value)} aria-label="Fin del descanso" />
                      </>
                    )}
                  </>
                )}
              </FragmentDay>
            );
          })}
        </div>
      </div>

      {error && <p className="err">{error}</p>}
      <div className="row">
        <button className="btn btn-pri" onClick={save}>Guardar cambios</button>
        {canDelete && (
          <button className={`btn btn-sm ${confirmDel ? 'btn-danger' : 'btn-ghost'}`} onClick={remove}>{confirmDel ? 'Sí, eliminar' : 'Eliminar profesional'}</button>
        )}
      </div>
      {confirmDel && <p className="muted small">Sus citas pasadas se conservan sin asignar. Si solo sale de vacaciones, usa un bloqueo o desmarca “Recibe citas en línea”.</p>}

      <div className="stack tight">
        <h3>Días libres y bloqueos</h3>
        <p className="muted small">Vacaciones, una diligencia, un día feriado. Esas horas no se ofrecen a las clientas.</p>
        {offs.length ? (
          <div className="stack tight">
            {offs.map((o) => (
              <div key={o.id} className="line-row">
                <span className="small"><b>{fmtDateShort(o.starts_at)}</b> · {fmtTime(o.starts_at)} – {fmtTime(o.ends_at)}{o.reason ? ` · ${o.reason}` : ''}</span>
                <button className="btn btn-sm btn-ghost" onClick={() => removeOff(o.id)}>Quitar</button>
              </div>
            ))}
          </div>
        ) : <p className="empty">Sin bloqueos próximos.</p>}
        <form className="row" onSubmit={addOff}>
          <input type="date" value={off.date} onChange={(e) => setOff({ ...off, date: e.target.value })} style={{ width: 'auto' }} aria-label="Fecha del bloqueo" />
          <label className="check-line"><input type="checkbox" checked={off.allDay} onChange={(e) => setOff({ ...off, allDay: e.target.checked })} />Todo el día</label>
          {!off.allDay && (
            <>
              <input type="time" value={off.from} onChange={(e) => setOff({ ...off, from: e.target.value })} style={{ width: 'auto' }} aria-label="Desde" />
              <input type="time" value={off.to} onChange={(e) => setOff({ ...off, to: e.target.value })} style={{ width: 'auto' }} aria-label="Hasta" />
            </>
          )}
          <input placeholder="Motivo (opcional)" value={off.reason} onChange={(e) => setOff({ ...off, reason: e.target.value })} style={{ width: 'auto', flex: '1 1 160px' }} aria-label="Motivo" />
          <button className="btn btn-sm" type="submit">Bloquear</button>
        </form>
      </div>
    </div>
  );
}

function FragmentDay({ label, children }) {
  return (
    <>
      <b className="small">{label}</b>
      <div className="times">{children}</div>
    </>
  );
}
