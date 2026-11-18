'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useToast } from '@/components/panel/PanelContext';
import { money, slugify } from '@/lib/format';

export default function Planes() {
  const supabase = supabaseBrowser();
  const [plans, setPlans] = useState(null);
  const [toast, setToast] = useToast();
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('plans').select('*').order('sort').order('price');
    setPlans(data || []);
  }, [supabase]);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="row between">
        <div className="stack tight">
          <h1 style={{ fontSize: 'clamp(1.6rem,3.5vw,2.2rem)' }}>Planes</h1>
          <p className="muted">Los precios se muestran en la portada y en el panel de cada negocio. Cambiar un precio no cambia lo que ya está pagado.</p>
        </div>
        <button className="btn btn-pri" onClick={() => setAdding(true)}>Agregar plan</button>
      </div>
      {adding && <PlanForm supabase={supabase} sort={(plans?.length || 0) + 1} onDone={(m) => { setAdding(false); if (m) { setToast(m); load(); } }} />}
      {plans === null ? <p className="muted">Cargando…</p> : (
        <div className="stack">
          {plans.map((p) => <PlanForm key={p.id} supabase={supabase} plan={p} onDone={(m) => { if (m) { setToast(m); load(); } }} />)}
        </div>
      )}
      {toast}
    </>
  );
}

function PlanForm({ supabase, plan, sort, onDone }) {
  const [f, setF] = useState({
    name: plan?.name || '', price: plan ? Number(plan.price) : '', max_staff: plan?.max_staff || 1,
    description: plan?.description || '', is_active: plan ? plan.is_active : true, sort: plan?.sort ?? sort,
  });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function save(e) {
    e.preventDefault();
    setError('');
    if (f.name.trim().length < 2) return setError('Ponle un nombre al plan.');
    const row = { name: f.name.trim(), price: Number(f.price || 0), max_staff: Number(f.max_staff), description: f.description.trim(), is_active: f.is_active, sort: Number(f.sort) };
    const { error: err } = plan
      ? await supabase.from('plans').update(row).eq('id', plan.id)
      : await supabase.from('plans').insert({ ...row, id: slugify(f.name).slice(0, 30) });
    if (err) return setError(err.code === '23505' ? 'Ya existe un plan con ese nombre.' : err.message);
    onDone(plan ? `Plan ${row.name} guardado` : `Plan ${row.name} creado`);
  }

  return (
    <form className={`card ${plan ? '' : 'sheet'}`} onSubmit={save} style={plan && !plan.is_active ? { opacity: 0.6 } : undefined}>
      <div className="row between">
        <h3>{plan ? plan.name : 'Nuevo plan'}</h3>
        {plan && <span className="muted small num">{money(plan.price)} / mes · hasta {plan.max_staff}</span>}
      </div>
      <div className="form-grid">
        <label className="field">Nombre<input value={f.name} onChange={set('name')} /></label>
        <label className="field">Precio al mes (RD$)<input type="number" min="0" step="10" value={f.price} onChange={set('price')} /></label>
        <label className="field">Máximo de profesionales<input type="number" min="1" max="500" value={f.max_staff} onChange={set('max_staff')} /></label>
        <label className="field">Orden<input type="number" min="0" value={f.sort} onChange={set('sort')} /></label>
        <label className="field full">Descripción corta<input value={f.description} onChange={set('description')} maxLength={120} /></label>
        <label className="check-line full"><input type="checkbox" checked={f.is_active} onChange={set('is_active')} /> Disponible para nuevos negocios y visible en la portada</label>
      </div>
      {error && <p className="err">{error}</p>}
      <div className="row">
        <button className="btn btn-pri btn-sm" type="submit">Guardar</button>
        {!plan && <button className="btn btn-sm btn-ghost" type="button" onClick={() => onDone(null)}>Cancelar</button>}
      </div>
    </form>
  );
}
