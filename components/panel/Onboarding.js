'use client';
import { useState } from 'react';
import { CATEGORIES, STARTER_SERVICES, digits, slugInput, slugify, validPhone } from '@/lib/format';

const HOST = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/^https?:\/\//, '') || 'tusilla.do';

export default function Onboarding({ supabase, user, onDone }) {
  const m = user.user_metadata || {};
  const [f, setF] = useState({
    name: m.business_name || '',
    slug: slugify(m.business_name || ''),
    category: m.category || 'estetica',
    phone: m.phone || '',
    city: '',
    address: '',
    staffName: '',
    starter: true,
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    const next = { ...f, [k]: v };
    if (k === 'name' && !slugTouched) next.slug = slugify(v);
    if (k === 'slug') { next.slug = slugInput(v); setSlugTouched(true); }
    setF(next);
  };

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (f.name.trim().length < 2) return setError('Escribe el nombre del negocio.');
    if (!validPhone(f.phone)) return setError('El WhatsApp debe tener 10 dígitos y empezar por 809, 829 u 849.');
    const slug = slugify(f.slug);
    if (slug.length < 3) return setError('El link debe tener al menos 3 letras.');
    setBusy(true);

    const { data: biz, error: e1 } = await supabase
      .from('businesses')
      .insert({
        owner_id: user.id, name: f.name.trim(), slug, category: f.category,
        phone: digits(f.phone), city: f.city.trim(), address: f.address.trim(),
      })
      .select()
      .single();
    if (e1) {
      setBusy(false);
      if (e1.code === '23505') return setError(`El link ${HOST}/${slug} ya está en uso. Prueba con otro.`);
      if (/slug_reserved/.test(e1.message)) return setError('Ese link está reservado. Prueba con otro.');
      return setError('No pudimos crear el negocio: ' + e1.message);
    }

    if (f.starter) {
      const rows = (STARTER_SERVICES[f.category] || []).map(([name, duration_min, price], i) => ({
        business_id: biz.id, name, duration_min, price, sort: i,
      }));
      if (rows.length) await supabase.from('services').insert(rows);
    }
    const { data: st } = await supabase
      .from('staff')
      .insert({ business_id: biz.id, name: f.staffName.trim() || 'Yo', role: 'Dueña / dueño' })
      .select()
      .single();
    if (st) {
      const hours = [1, 2, 3, 4, 5, 6].map((d) => ({ staff_id: st.id, weekday: d, start_time: '09:00', end_time: '18:00' }));
      await supabase.from('working_hours').insert(hours);
    }
    onDone();
  }

  return (
    <form className="card stack loose" style={{ maxWidth: 680 }} onSubmit={submit}>
      <div className="stack tight">
        <p className="eyebrow">Bienvenida</p>
        <h2>Configura tu negocio</h2>
        <p className="muted">Con esto creamos tu página de reservas. Todo se puede cambiar después.</p>
      </div>
      <div className="form-grid">
        <label className="field full">Nombre del negocio
          <input id="o-name" value={f.name} onChange={set('name')} required />
        </label>
        <label className="field full">Tu link
          <span className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
            <span className="muted small" style={{ whiteSpace: 'nowrap' }}>{HOST}/</span>
            <input id="o-slug" value={f.slug} onChange={set('slug')} required />
          </span>
        </label>
        <label className="field">Tipo
          <select id="o-cat" value={f.category} onChange={set('category')}>
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="field">WhatsApp del negocio
          <input id="o-phone" value={f.phone} onChange={set('phone')} inputMode="tel" placeholder="809-555-1234" required />
        </label>
        <label className="field">Ciudad
          <input id="o-city" value={f.city} onChange={set('city')} placeholder="Santo Domingo" />
        </label>
        <label className="field">Dirección
          <input id="o-addr" value={f.address} onChange={set('address')} placeholder="Calle, número, sector" />
        </label>
        <label className="field full">¿Quién atiende? <span className="hint">Tu nombre o el de la primera profesional. Luego agregas a las demás.</span>
          <input id="o-staff" value={f.staffName} onChange={set('staffName')} placeholder="Ej. Paola" />
        </label>
        <label className="check-line full">
          <input id="o-starter" type="checkbox" checked={f.starter} onChange={set('starter')} />
          Agregar servicios de ejemplo de {CATEGORIES[f.category].toLowerCase()} para editarlos después
        </label>
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      <div><button className="btn btn-pri" type="submit" disabled={busy}>{busy ? 'Creando…' : 'Crear mi página'}</button></div>
    </form>
  );
}
