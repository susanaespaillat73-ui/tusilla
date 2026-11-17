'use client';
import { useState } from 'react';
import { usePanel, useToast } from '@/components/panel/PanelContext';
import { CATEGORIES, digits, fmtPhone, slugInput, slugify, validPhone } from '@/lib/format';

export default function Ajustes() {
  const { supabase, biz, setBiz } = usePanel();
  const [f, setF] = useState({
    name: biz.name, slug: biz.slug, category: biz.category, description: biz.description, phone: fmtPhone(biz.phone),
    address: biz.address, city: biz.city, instagram: biz.instagram, accent: biz.accent, logo_url: biz.logo_url || '',
    slot_step: biz.slot_step, min_notice_min: biz.min_notice_min, max_days_ahead: biz.max_days_ahead,
    cancel_hours: biz.cancel_hours, is_published: biz.is_published,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useToast();
  const [pass, setPass] = useState('');
  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setF({ ...f, [k]: k === 'slug' ? slugInput(v) : v });
  };
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const link = `${origin}/${biz.slug}`;

  async function save(e) {
    e.preventDefault();
    setError('');
    if (f.name.trim().length < 2) return setError('Escribe el nombre del negocio.');
    if (!validPhone(f.phone)) return setError('El WhatsApp debe tener 10 dígitos y empezar por 809, 829 u 849.');
    if (f.logo_url && !/^https:\/\//.test(f.logo_url)) return setError('El link del logo debe empezar por https://');
    setBusy(true);
    const { data, error: err } = await supabase.from('businesses').update({
      name: f.name.trim(), slug: slugify(f.slug), category: f.category, description: f.description.trim(), phone: digits(f.phone),
      address: f.address.trim(), city: f.city.trim(), instagram: f.instagram.trim(), accent: f.accent,
      logo_url: f.logo_url.trim() || null, slot_step: Number(f.slot_step), min_notice_min: Number(f.min_notice_min),
      max_days_ahead: Number(f.max_days_ahead), cancel_hours: Number(f.cancel_hours), is_published: f.is_published,
    }).eq('id', biz.id).select().single();
    setBusy(false);
    if (err) {
      if (err.code === '23505') return setError('Ese link ya lo usa otro negocio. Prueba con otro.');
      if (/slug/.test(err.message)) return setError('El link solo puede tener letras, números y guiones (3 a 40), y no puede ser una palabra reservada.');
      return setError(err.message);
    }
    setBiz(data);
    setToast(data.slug !== biz.slug ? `Guardado. Tu nuevo link es ${origin}/${data.slug}` : 'Cambios guardados');
  }

  async function copy() {
    try { await navigator.clipboard.writeText(link); setToast('Link copiado'); } catch { setToast(link); }
  }
  async function changePass(e) {
    e.preventDefault();
    if (pass.length < 8) return setToast('La contraseña debe tener al menos 8 caracteres.');
    const { error: err } = await supabase.auth.updateUser({ password: pass });
    setPass('');
    setToast(err ? err.message : 'Contraseña cambiada');
  }

  return (
    <>
      <h1 style={{ fontSize: 'clamp(1.6rem,3.5vw,2.2rem)' }}>Ajustes</h1>

      <div className="card">
        <h3>Tu link de reservas</h3>
        <p className="muted small">Ponlo en la bio de Instagram, en tus estados de WhatsApp y en un código QR en el mostrador.</p>
        <div className="row">
          <code className="mono" style={{ overflowWrap: 'anywhere' }}>{link}</code>
          <button className="btn btn-sm" onClick={copy}>Copiar</button>
          <a className="btn btn-sm" target="_blank" rel="noopener" href={`https://api.qrserver.com/v1/create-qr-code/?size=800x800&margin=20&data=${encodeURIComponent(link)}`}>Código QR</a>
        </div>
      </div>

      <form className="card stack loose" onSubmit={save}>
        <div className="stack">
          <h3>Datos del negocio</h3>
          <div className="form-grid">
            <label className="field">Nombre<input id="a-name" value={f.name} onChange={set('name')} /></label>
            <label className="field">Link <span className="hint">{origin}/{f.slug}</span><input id="a-slug" value={f.slug} onChange={set('slug')} /></label>
            <label className="field">Tipo
              <select id="a-cat" value={f.category} onChange={set('category')}>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </label>
            <label className="field">WhatsApp<input id="a-phone" value={f.phone} onChange={set('phone')} inputMode="tel" /></label>
            <label className="field">Dirección<input id="a-addr" value={f.address} onChange={set('address')} /></label>
            <label className="field">Ciudad<input id="a-city" value={f.city} onChange={set('city')} /></label>
            <label className="field">Instagram<input id="a-ig" value={f.instagram} onChange={set('instagram')} placeholder="@tuestetica" /></label>
            <label className="field">Color de tu marca<input id="a-accent" type="color" value={f.accent} onChange={set('accent')} /></label>
            <label className="field full">Descripción <span className="hint">Aparece en tu página. 1 o 2 líneas.</span>
              <textarea id="a-desc" value={f.description} onChange={set('description')} maxLength={300} style={{ minHeight: 80 }} />
            </label>
            <label className="field full">Logo (link de la imagen) <span className="hint">Opcional. Por ejemplo, el link de tu foto de perfil subida a Google Drive o Imgur.</span>
              <input id="a-logo" value={f.logo_url} onChange={set('logo_url')} placeholder="https://…" />
            </label>
          </div>
        </div>

        <div className="stack">
          <h3>Reglas de reserva</h3>
          <div className="form-grid">
            <label className="field">Las horas se ofrecen cada
              <select id="a-step" value={f.slot_step} onChange={set('slot_step')}>{[10, 15, 20, 30, 45, 60].map((n) => <option key={n} value={n}>{n} minutos</option>)}</select>
            </label>
            <label className="field">Reservar con al menos
              <select id="a-notice" value={f.min_notice_min} onChange={set('min_notice_min')}>
                {[[0, 'Sin mínimo'], [30, '30 minutos'], [60, '1 hora'], [120, '2 horas'], [240, '4 horas'], [720, '12 horas'], [1440, '1 día']].map(([v, l]) => <option key={v} value={v}>{l} de anticipación</option>)}
              </select>
            </label>
            <label className="field">Agenda abierta hasta
              <select id="a-max" value={f.max_days_ahead} onChange={set('max_days_ahead')}>{[7, 14, 21, 30, 45, 60, 90].map((n) => <option key={n} value={n}>{n} días adelante</option>)}</select>
            </label>
            <label className="field">Cancelación en línea hasta
              <select id="a-cancel" value={f.cancel_hours} onChange={set('cancel_hours')}>{[0, 1, 2, 4, 12, 24, 48].map((n) => <option key={n} value={n}>{n === 0 ? 'Hasta la hora de la cita' : `${n} h antes`}</option>)}</select>
            </label>
            <label className="check-line full"><input type="checkbox" checked={f.is_published} onChange={set('is_published')} /> Mi página está visible y recibe reservas</label>
          </div>
        </div>
        {error && <p className="err">{error}</p>}
        <div><button className="btn btn-pri" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar cambios'}</button></div>
      </form>

      <form className="card" onSubmit={changePass} id="clave">
        <h3>Cambiar contraseña</h3>
        <div className="row">
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Nueva contraseña" autoComplete="new-password" style={{ maxWidth: 320 }} aria-label="Nueva contraseña" />
          <button className="btn btn-sm" type="submit">Cambiar</button>
        </div>
      </form>
      {toast}
    </>
  );
}
