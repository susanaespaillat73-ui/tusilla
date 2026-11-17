'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { PanelProvider } from '@/components/panel/PanelContext';
import Onboarding from '@/components/panel/Onboarding';
import { contrastText } from '@/lib/format';

const NAV = [
  ['/panel', 'Agenda'],
  ['/panel/servicios', 'Servicios'],
  ['/panel/equipo', 'Equipo y horarios'],
  ['/panel/recordatorios', 'Recordatorios'],
  ['/panel/reportes', 'Reportes'],
  ['/panel/ajustes', 'Ajustes'],
];

export default function PanelLayout({ children }) {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const path = usePathname();
  const [user, setUser] = useState(null);
  const [biz, setBiz] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | onboarding | error

  const loadBiz = useCallback(async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) { router.replace('/entrar?next=' + encodeURIComponent(path)); return; }
    setUser(u);
    const { data, error } = await supabase.from('businesses').select('*').eq('owner_id', u.id).order('created_at').limit(1).maybeSingle();
    if (error) { setState('error'); return; }
    if (!data) { setState('onboarding'); return; }
    setBiz(data);
    setState('ready');
  }, [supabase, router, path]);

  useEffect(() => { loadBiz(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/entrar');
    router.refresh();
  }

  const ctx = useMemo(() => ({ supabase, user, biz, setBiz, reloadBiz: loadBiz }), [supabase, user, biz, loadBiz]);
  const style = biz ? { '--accent': biz.accent, '--accent-ink': contrastText(biz.accent) } : undefined;

  return (
    <div style={style}>
      <header className="p-top">
        <div className="wrap p-row">
          <Link href="/" className="brand"><span className="brand-mark">TS</span>{biz ? biz.name : 'TuSilla'}</Link>
          <div className="row">
            {biz && <Link className="btn btn-sm" href={`/${biz.slug}`} target="_blank">Ver mi página</Link>}
            {user && <button className="btn btn-sm btn-ghost" onClick={signOut}>Salir</button>}
          </div>
        </div>
        {state === 'ready' && (
          <nav className="p-nav wrap" aria-label="Secciones del panel">
            {NAV.map(([href, label]) => (
              <Link key={href} href={href} className={path === href ? 'on' : ''}>{label}</Link>
            ))}
          </nav>
        )}
      </header>
      <main className="wrap p-body">
        {state === 'loading' && <p className="muted">Cargando tu panel…</p>}
        {state === 'error' && (
          <div className="note warn">No pudimos cargar tu negocio. Revisa tu conexión y <button className="btn btn-sm" onClick={loadBiz}>intenta de nuevo</button></div>
        )}
        {state === 'onboarding' && user && <Onboarding supabase={supabase} user={user} onDone={loadBiz} />}
        {state === 'ready' && <PanelProvider value={ctx}>{children}</PanelProvider>}
      </main>
    </div>
  );
}
