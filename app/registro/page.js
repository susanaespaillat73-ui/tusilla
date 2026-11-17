'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SiteHeader } from '@/components/Site';
import { supabaseBrowser } from '@/lib/supabase/client';
import { CATEGORIES, digits, validPhone } from '@/lib/format';

export default function Registro() {
  const router = useRouter();
  const [f, setF] = useState({ business_name: '', category: 'estetica', phone: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (f.business_name.trim().length < 2) return setError('Escribe el nombre de tu negocio.');
    if (!validPhone(f.phone)) return setError('El WhatsApp debe tener 10 dígitos y empezar por 809, 829 u 849.');
    if (f.password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    setBusy(true);
    const { data, error: err } = await supabaseBrowser().auth.signUp({
      email: f.email.trim(),
      password: f.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/panel`,
        data: { business_name: f.business_name.trim(), category: f.category, phone: digits(f.phone) },
      },
    });
    setBusy(false);
    if (err) {
      setError(/registered/i.test(err.message) ? 'Ese correo ya tiene cuenta. Entra con tu contraseña.' : err.message);
      return;
    }
    if (data.session) router.push('/panel');
    else setSentTo(f.email.trim());
  }

  return (
    <>
      <SiteHeader><Link className="link" href="/entrar">Ya tengo cuenta</Link></SiteHeader>
      <main className="wrap center-page">
        <div className="card auth-card">
          {sentTo ? (
            <div className="stack">
              <h2>Revisa tu correo</h2>
              <p className="muted">
                Te enviamos un link a <b>{sentTo}</b>. Ábrelo para activar tu cuenta y entrar al panel. Si no lo ves, busca en Spam o Promociones.
              </p>
            </div>
          ) : (
            <form className="stack" onSubmit={submit}>
              <div className="stack tight">
                <p className="eyebrow">Gratis para empezar</p>
                <h2>Crea el link de reservas de tu negocio</h2>
              </div>
              <label className="field">Nombre del negocio
                <input id="r-name" value={f.business_name} onChange={set('business_name')} placeholder="Ej. Estética Luz" required />
              </label>
              <div className="form-grid">
                <label className="field">Tipo
                  <select id="r-cat" value={f.category} onChange={set('category')}>
                    {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <label className="field">WhatsApp del negocio
                  <input id="r-phone" value={f.phone} onChange={set('phone')} inputMode="tel" placeholder="809-555-1234" required />
                </label>
              </div>
              <label className="field">Tu correo
                <input id="r-email" type="email" value={f.email} onChange={set('email')} autoComplete="email" required />
              </label>
              <label className="field">Contraseña <span className="hint">Mínimo 8 caracteres</span>
                <input id="r-pass" type="password" value={f.password} onChange={set('password')} autoComplete="new-password" required />
              </label>
              {error && <p className="err" role="alert">{error}</p>}
              <button className="btn btn-pri btn-block" type="submit" disabled={busy}>{busy ? 'Creando…' : 'Crear mi cuenta'}</button>
            </form>
          )}
        </div>
      </main>
    </>
  );
}
