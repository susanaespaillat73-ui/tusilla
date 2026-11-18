'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { BRAND, BRAND_MARK } from '@/lib/brand';

const NAV = [
  ['/admin', 'Resumen'],
  ['/admin/negocios', 'Negocios'],
  ['/admin/planes', 'Planes'],
  ['/admin/ajustes', 'Cobros y prueba'],
];

export default function AdminLayout({ children }) {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const path = usePathname();
  const [state, setState] = useState('loading'); // loading | ok | denied

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/entrar?next=/admin'); return; }
      const { data } = await supabase.rpc('am_i_admin');
      setState(data ? 'ok' : 'denied');
    })();
  }, [supabase, router]);

  return (
    <div>
      <header className="p-top">
        <div className="wrap p-row">
          <Link href="/admin" className="brand"><span className="brand-mark">{BRAND_MARK}</span>{BRAND} · Administración</Link>
          <div className="row">
            <Link className="btn btn-sm btn-ghost" href="/panel">Mi panel</Link>
            <Link className="btn btn-sm btn-ghost" href="/" target="_blank">Ver portada</Link>
          </div>
        </div>
        {state === 'ok' && (
          <nav className="p-nav wrap" aria-label="Secciones de administración">
            {NAV.map(([href, label]) => (
              <Link key={href} href={href} className={path === href ? 'on' : ''}>{label}</Link>
            ))}
          </nav>
        )}
      </header>
      <main className="wrap p-body">
        {state === 'loading' && <p className="muted">Cargando…</p>}
        {state === 'denied' && (
          <div className="empty-state"><b>Esta sección es solo para quien administra {BRAND}.</b><Link className="btn btn-sm" href="/panel">Ir a mi panel</Link></div>
        )}
        {state === 'ok' && children}
      </main>
    </div>
  );
}
