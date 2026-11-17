import Link from 'next/link';
import { SiteHeader, SiteFooter } from '@/components/Site';

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="wrap narrow done">
        <h1 style={{ fontSize: '2rem' }}>No encontramos esa página</h1>
        <p className="muted">El link puede estar mal escrito, o el negocio cambió su dirección.</p>
        <div><Link className="btn btn-pri" href="/">Buscar negocios</Link></div>
      </main>
      <SiteFooter />
    </>
  );
}
