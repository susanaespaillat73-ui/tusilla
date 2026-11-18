'use client';
import Link from 'next/link';
import { daysUntil, fmtDateLong, money } from '@/lib/format';

/** Aviso arriba del panel: días de prueba, vencimiento o cuenta vencida. */
export default function AccountBanner({ account: a }) {
  if (!a) return null;
  const plan = a.plan || {};
  const after = `Después sigue el plan ${plan.name} por ${money(plan.price)} al mes.`;

  if (a.state === 'trial') {
    const d = daysUntil(a.trial_ends_at);
    return (
      <div className={`note ${d <= 3 ? 'warn' : ''}`}>
        <b>Prueba gratis: {d <= 1 ? 'termina hoy' : `te quedan ${d} días`}</b> (hasta el {fmtDateLong(a.trial_ends_at)}). {after}{' '}
        <Link href="/panel/ajustes#plan">Ver planes y forma de pago</Link>
      </div>
    );
  }
  if (a.state === 'active') {
    const d = daysUntil(a.paid_until);
    if (d > 5) return null;
    return (
      <div className="note warn">
        <b>Tu plan se renueva el {fmtDateLong(a.paid_until)}.</b> Realiza tu pago para no interrumpir las reservas.{' '}
        <Link href="/panel/ajustes#plan">Cómo pagar</Link>
      </div>
    );
  }
  if (a.state === 'grace') {
    return (
      <div className="note warn">
        <b>Tu periodo venció.</b> Tu página seguirá recibiendo reservas hasta el {fmtDateLong(a.grace_until)}. Después se pausa hasta que se registre el pago.{' '}
        <Link href="/panel/ajustes#plan">Cómo pagar</Link>
      </div>
    );
  }
  return (
    <div className="note warn" style={{ background: 'var(--bad-soft)' }}>
      <b>{a.state === 'suspended' ? 'Tu cuenta está suspendida.' : 'Tu cuenta está vencida.'}</b> Tu página no está recibiendo reservas en línea. Tus datos y tu agenda siguen guardados.{' '}
      <Link href="/panel/ajustes#plan">Reactivar mi cuenta</Link>
    </div>
  );
}
