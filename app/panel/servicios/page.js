'use client';
import { useState } from 'react';
import { usePanel, useCatalog, useToast } from '@/components/panel/PanelContext';
import { money } from '@/lib/format';

const DURATIONS = [10, 15, 20, 30, 40, 45, 60, 75, 90, 105, 120, 150, 180, 240];

export default function Servicios() {
  const { supabase, biz } = usePanel();
  const { services, loaded, reload } = useCatalog(supabase, biz.id);
  const [toast, setToast] = useToast();
  const [editing, setEditing] = useState(null); // id | 'new'

  return (
    <>
      <div className="row between">
        <div className="stack tight">
          <h1 style={{ fontSize: 'clamp(1.6rem,3.5vw,2.2rem)' }}>Servicios</h1>
          <p className="muted">Lo que tus clientas pueden reservar. La duración define cuánto tiempo se bloquea en la agenda.</p>
        </div>
        <button className="btn btn-pri" onClick={() => setEditing('new')}>Agregar servicio</button>
      </div>

      {editing === 'new' && (
        <ServiceForm supabase={supabase} biz={biz} sort={services.length}
          onDone={(m) => { setEditing(null); if (m) { setToast(m); reload(); } }} />
      )}

      {!loaded ? <p className="muted">Cargando…</p> : !services.length && editing !== 'new' ? (
        <div className="empty-state"><b>Aún no tienes servicios.</b><span>Agrega el primero para que aparezca en tu página.</span></div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Servicio</th><th className="r">Duración</th><th className="r">Precio</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {services.map((s) => editing === s.id ? (
                  <tr key={s.id}><td colSpan={5}>
                    <ServiceForm supabase={supabase} biz={biz} service={s}
                      onDone={(m) => { setEditing(null); if (m) { setToast(m); reload(); } }} />
                  </td></tr>
                ) : (
                  <tr key={s.id} style={{ opacity: s.is_active ? 1 : 0.55 }}>
                    <td><b>{s.name}</b>{s.description && <div className="muted small">{s.description}</div>}</td>
                    <td className="r">{s.duration_min} min</td>
                    <td className="r">{Number(s.price) > 0 ? money(s.price) : 'Consultar'}</td>
                    <td><span className={`pill ${s.is_active ? 'completed' : 'cancelled'}`}>{s.is_active ? 'Visible' : 'Oculto'}</span></td>
                    <td className="r"><button className="btn btn-sm" onClick={() => setEditing(s.id)}>Editar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {toast}
    </>
  );
}

function ServiceForm({ supabase, biz, service, sort = 0, onDone }) {
  const [f, setF] = useState({
    name: service?.name || '',
    description: service?.description || '',
    duration_min: service?.duration_min || 60,
    price: service ? Number(service.price) : '',
    is_active: service ? service.is_active : true,
  });
  const [error, setError] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function save(e) {
    e.preventDefault();
    if (f.name.trim().length < 2) return setError('Escribe el nombre del servicio.');
    const row = {
      name: f.name.trim(), description: f.description.trim(), duration_min: Number(f.duration_min),
      price: Number(f.price || 0), is_active: f.is_active,
    };
    const { error: err } = service
      ? await supabase.from('services').update(row).eq('id', service.id)
      : await supabase.from('services').insert({ ...row, business_id: biz.id, sort });
    if (err) return setError(err.message);
    onDone(service ? 'Servicio guardado' : 'Servicio agregado');
  }

  async function remove() {
    if (!confirmDel) return setConfirmDel(true);
    const { error: err } = await supabase.from('services').delete().eq('id', service.id);
    if (err) return setError(err.message);
    onDone('Servicio eliminado');
  }

  return (
    <form className={service ? 'stack' : 'card sheet'} onSubmit={save}>
      {!service && <h3>Nuevo servicio</h3>}
      <div className="form-grid">
        <label className="field">Nombre<input id={`s-name-${service?.id || 'new'}`} value={f.name} onChange={set('name')} required /></label>
        <label className="field">Precio (RD$) <span className="hint">Deja 0 para mostrar “Consultar”</span>
          <input id={`s-price-${service?.id || 'new'}`} type="number" min="0" step="50" value={f.price} onChange={set('price')} />
        </label>
        <label className="field">Duración
          <select id={`s-dur-${service?.id || 'new'}`} value={f.duration_min} onChange={set('duration_min')}>
            {[...new Set([...DURATIONS, Number(f.duration_min)])].sort((a, b) => a - b).map((d) => (
              <option key={d} value={d}>{d < 60 ? `${d} min` : `${Math.floor(d / 60)} h${d % 60 ? ` ${d % 60} min` : ''}`}</option>
            ))}
          </select>
        </label>
        <label className="check-line" style={{ alignSelf: 'end', paddingBottom: 10 }}>
          <input type="checkbox" checked={f.is_active} onChange={set('is_active')} /> Visible en mi página
        </label>
        <label className="field full">Descripción corta <span className="hint">Opcional</span>
          <input id={`s-desc-${service?.id || 'new'}`} value={f.description} onChange={set('description')} maxLength={140} />
        </label>
      </div>
      {error && <p className="err">{error}</p>}
      <div className="row">
        <button className="btn btn-pri btn-sm" type="submit">Guardar</button>
        <button className="btn btn-sm btn-ghost" type="button" onClick={() => onDone(null)}>Cancelar</button>
        {service && (
          <button className={`btn btn-sm ${confirmDel ? 'btn-danger' : 'btn-ghost'}`} type="button" onClick={remove}>
            {confirmDel ? 'Sí, eliminar' : 'Eliminar'}
          </button>
        )}
      </div>
      {confirmDel && <p className="muted small">Las citas pasadas se conservan. Si solo quieres dejar de ofrecerlo, desmarca “Visible”.</p>}
    </form>
  );
}
