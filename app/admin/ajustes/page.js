'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useToast } from '@/components/panel/PanelContext';
import { digits, fmtPhone, validPhone } from '@/lib/format';

export default function AdminAjustes() {
  const supabase = supabaseBrowser();
  const [f, setF] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useToast();

  useEffect(() => {
    supabase.from('platform_settings').select('*').eq('id', 1).single().then(({ data }) =>
      setF(data ? { ...data, support_whatsapp: fmtPhone(data.support_whatsapp || '') } : null));
  }, [supabase]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    setError('');
    if (f.support_whatsapp && !validPhone(f.support_whatsapp)) return setError('El WhatsApp debe tener 10 dígitos y empezar por 809, 829 u 849.');
    const { error: err } = await supabase.from('platform_settings').update({
      trial_days: Number(f.trial_days), grace_days: Number(f.grace_days), trial_max_staff: Number(f.trial_max_staff),
      payment_instructions: f.payment_instructions.trim(), support_whatsapp: digits(f.support_whatsapp),
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
    if (err) return setError(err.message);
    setToast('Ajustes guardados');
  }

  if (!f) return <p className="muted">Cargando…</p>;

  return (
    <>
      <h1 style={{ fontSize: 'clamp(1.6rem,3.5vw,2.2rem)' }}>Cobros y prueba gratis</h1>
      <form className="card stack loose" onSubmit={save} style={{ maxWidth: 760 }}>
        <div className="form-grid">
          <label className="field">Días de prueba gratis <span className="hint">Para los negocios que se registren desde ahora</span>
            <input type="number" min="0" max="90" value={f.trial_days} onChange={set('trial_days')} />
          </label>
          <label className="field">Días de gracia <span className="hint">Después de vencer, la página sigue recibiendo reservas estos días</span>
            <input type="number" min="0" max="30" value={f.grace_days} onChange={set('grace_days')} />
          </label>
          <label className="field">Profesionales permitidas en la prueba
            <input type="number" min="1" max="500" value={f.trial_max_staff} onChange={set('trial_max_staff')} />
          </label>
          <label className="field">Tu WhatsApp de cobros y soporte
            <input value={f.support_whatsapp} onChange={set('support_whatsapp')} inputMode="tel" placeholder="809-555-1234" />
          </label>
          <label className="field full">Instrucciones de pago <span className="hint">Las ve cada negocio en Ajustes → Mi plan. Pon banco, tipo y número de cuenta, nombre y RNC, y a dónde mandar el comprobante.</span>
            <textarea value={f.payment_instructions} onChange={set('payment_instructions')} style={{ minHeight: 140 }} />
          </label>
        </div>
        {error && <p className="err">{error}</p>}
        <div><button className="btn btn-pri" type="submit">Guardar</button></div>
      </form>
      {toast}
    </>
  );
}
