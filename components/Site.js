import Link from 'next/link';

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="TuSilla, inicio">
      <span className="brand-mark">TS</span>TuSilla
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
        <span>© {new Date().getFullYear()} TuSilla · Hecho en República Dominicana</span>
        <span className="row">
          <Link href="/registro">Registrar mi negocio</Link>
          <Link href="/entrar">Entrar al panel</Link>
        </span>
      </div>
    </footer>
  );
}
