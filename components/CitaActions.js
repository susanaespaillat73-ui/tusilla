'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BOOKING_ERRORS } from '@/lib/format';

export default function CitaActions({ token, canCancel, status, cancelHours, gcal, isNew }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);

  async function cancel() {
    if (!confirming) return setConfirming(true);
    setBusy(true);
    const res = await fetch('/api/cancel', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
    }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res || !res.ok) { setMsg(BOOKING_ERRORS[json.error] || 'No pudimos cancelar. Intenta de nuevo.'); setConfirming(false); return; }
    router.replace(`/cita/${token}`);
    router.refresh();
  }

  async function copy() {
    const url = window.location.origin + `/cita/${token}`;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { window.prompt?.('Copia este link', url); }
  }

  if (status === 'cancelled') return null;

  return (
    <div className="stack">
      <div className="row">
        {status === 'confirmed' && (
          <a className="btn btn-pri" href={gcal} target="_blank" rel="noopener">Agregar a mi calendario</a>
        )}
        {isNew && <button type="button" className="btn" onClick={copy}>{copied ? 'Link copiado' : 'Copiar link de mi cita'}</button>}
        {canCancel && (
          <button type="button" className={`btn ${confirming ? 'btn-danger' : 'btn-ghost'}`} onClick={cancel} disabled={busy}>
            {busy ? 'Cancelando…' : confirming ? 'Sí, cancelar mi cita' : 'Cancelar cita'}
          </button>
        )}
      </div>
      {confirming && !busy && <p className="muted small">Toca de nuevo para confirmar. Esto libera la hora para otra persona.</p>}
      {!canCancel && status === 'confirmed' && cancelHours > 0 && (
        <p className="muted small">Faltan menos de {cancelHours} h para tu cita. Para cancelar, escríbele al negocio.</p>
      )}
      {msg && <p className="err">{msg}</p>}
    </div>
  );
}
