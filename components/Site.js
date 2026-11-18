import Link from 'next/link';
import { BRAND, BRAND_MARK } from '@/lib/brand';

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label={`${BRAND}, inicio`}>
      <span className="brand-mark">{BRAND_MARK}</span>{BRAND}
    </Link>
  );
}

export function SiteHeader({ children }) {
  return (
    <header className="site-head">
      <div className="wrap">
        <Brand />
        <nav>
          {children ?? (
            <>
              <Link className="link" href="/#negocios">Para negocios</Link>
              <Link className="link" href="/entrar">Entrar</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-foot">
      <div className="wrap">
        <span>© {new Date().getFullYear()} {BRAND} · Hecho en República Dominicana</span>
        <span className="row">
          <Link href="/registro">Registrar mi negocio</Link>
          <Link href="/entrar">Entrar al panel</Link>
        </span>
      </div>
    </footer>
  );
}
