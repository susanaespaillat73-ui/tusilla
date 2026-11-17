'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { SiteHeader } from '@/components/Site';
import { supabaseBrowser } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(params.get('error') === 'link' ? 'El link expiró o ya se usó. Entra con tu correo y contraseña.' : '');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(''); setInfo(''); setBusy(true);
    const { error: err } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) {
      setError(/confirm/i.test(err.message) ? 'Primero confirma tu correo con el link que te enviamos.' : 'Correo o contraseña incorrectos.');
      return;
    }
    let next = params.get('next') || '/panel';
    if (!next.startsWith('/panel')) next = '/panel';
    router.replace(next);
    router.refresh();
  }

  async function forgot() {
    setError(''); setInfo('');
    if (!email.trim()) return setError('Escribe tu correo arriba y vuelve a tocar "Olvidé mi contraseña".');
    const { error: err } = await supabaseBrowser().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/panel/ajustes`,
    });
    if (err) setError(err.message);
    else setInfo('Te enviamos un link para entrar. Luego cambia tu contraseña en Ajustes.');
  }

  return (
    <form className="card auth-card stack" onSubmit={submit}>
      <div className="stack tight">
        <p className="eyebrow">Panel del negocio</p>
        <h2>Entrar</h2>
      </div>
      <label className="field">Correo
        <input id="l-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </label>
      <label className="field">Contraseña
        <input id="l-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </label>
      {error && <p className="err" role="alert">{error}</p>}
      {info && <p className="ok-msg">{info}</p>}
      <button className="btn btn-pri btn-block" type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      <div className="row between small">
        <button type="button" className="btn btn-ghost btn-sm" onClick={forgot}>Olvidé mi contraseña</button>
        <Link href="/registro">Crear cuenta</Link>
      </div>
    </form>
  );
}

export default function Entrar() {
  return (
    <>
      <SiteHeader><Link className="link" href="/registro">Registrar mi negocio</Link></SiteHeader>
      <main className="wrap center-page">
        <Suspense fallback={null}><LoginForm /></Suspense>
      </main>
    </>
  );
}
