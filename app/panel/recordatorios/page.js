'use client';
import { useCallback, useEffect, useState } from 'react';
import { usePanel, useToast } from '@/components/panel/PanelContext';
import { DEFAULT_TPL, TPL_LABEL, fillTemplate, fmtDateShort, fmtPhone, fmtTime, waLink } from '@/lib/format';

const KINDS = [
  ['tpl_confirm', 'confirm_sent_at', 'auto_confirm', 'Confirmación'],
  ['tpl_24h', 'reminder_24h_sent_at', 'auto_24h', '24 h antes'],
  ['tpl_2h', 'reminder_2h_sent_at', 'auto_2h', '2 h antes'],
];

export default function Recordatorios() {
  const { supabase, biz, setBiz } = usePanel();
  const [status, setStatus] = useState(null);
  const [queue, setQueue] = useState(null);
  const [staffNames, setStaffNames] = useState({});
  const [tplKey, setTplKey] = useState('tpl_24h');
  const [draft, setDraft] = useState(biz[tplKey] || DEFAULT_TPL[tplKey]);
  const [toast, setToast] = useToast();
  const site = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => { fetch('/api/whatsapp-status').then((r) => r.json()).then(setStatus).catch(() => setStatus({ configured: false })); }, []);

  const load = useCallback(async () => {
    const now = new Date();
    const [{ data }, { data: st }] = await Promise.all([
      supabase.from('appointments').select('*').eq('business_id', biz.id).eq('status', 'confirmed')
        .gt('starts_at', now.toISOString()).lte('starts_at', new Date(now.getTime() + 48 * 3600e3).toISOString()).order('starts_at'),
      supabase.from('staff').select('id,name').eq('business_id', biz.id),
    ]);
    setStaffNames(Object.fromEntries((st || []).map((s) => [s.id, s.name])));
    setQueue(data || []);
  }, [supabase, biz.id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setDraft(biz[tplKey] || DEFAULT_TPL[tplKey]); }, [tplKey, biz]);

  async function toggle(col) {
    const { data, error } = await supabase.from('businesses').update({ [col]: !biz[col] }).eq('id', biz.id).select().single();
    if (error) return setToast(error.message);
    setBiz(data);
  }
  async function saveTpl(value) {
    const { data, error } = await supabase.from('businesses').update({ [tplKey]: value }).eq('id', biz.id).select().single();
    if (error) return setToast(error.message);
    setBiz(data); setToast('Mensaje guardado');
  }
  async function markSent(a, col) {
    await supabase.from('appointments').update({ [col]: new Date().toISOString() }).eq('id', a.id);
    setTimeout(load, 400);
  }

  const vars = (a) => ({ ...a, staff_name: staffNames[a.staff_id], business_name: biz.name, address: biz.address, link: `${site}/cita/${a.manage_token}` });
  const sample = queue?.[0] ? vars(queue[0]) : {
    customer_name: 'Carolina Jiménez', service_name: 'Limpieza facial', staff_name: 'Paola', business_name: biz.name,
    address: biz.address, starts_at: new Date(Date.now() + 864e5).toISOString(), link: `${site}/cita/…`,
  };

  function stateOf(a, tplKey2, col) {
    if (a[col]) return { c: 'sent', l: 'Enviado' };
    if (tplKey2 === 'tpl_confirm') return { c: 'due', l: 'Pendiente' };
    const due = Date.parse(a.starts_at) - (tplKey2 === 'tpl_24h' ? 24 : 2) * 3600e3;
    if (due <= Date.now()) return { c: 'due', l: 'Pendiente' };
    return { c: 'sched', l: `${fmtDateShort(new Date(due).toISOString())}, ${fmtTime(new Date(due).toISOString())}` };
  }
  const pending = (queue || []).reduce((n, a) => n + KINDS.filter(([k, col]) => stateOf(a, k, col).c === 'due').length, 0);

  return (
    <>
      <div className="stack tight">
        <h1 style={{ fontSize: 'clamp(1.6rem,3.5vw,2.2rem)' }}>Recordatorios por WhatsApp</h1>
        <p className="muted">Menos clientas que se olvidan. Cada cita recibe una confirmación y dos recordatorios.</p>
      </div>

      {status && (status.configured ? (
        <div className="note ok"><b>Envío automático activo.</b> Los mensajes salen solos por WhatsApp. Abajo puedes ver el estado de cada uno.</div>
      ) : (
        <div className="note warn">
          <b>Envío automático aún no conectado.</b> Mientras tanto, toca <b>Enviar</b> en cada cita: se abre WhatsApp con el mensaje listo para mandarlo desde tu número.
        </div>
      ))}

      <div className="two">
        <div className="card">
          <h3>Qué se envía</h3>
          {KINDS.map(([k, , autoCol]) => (
            <div className="line-row" key={k}>
              <span className="stack tight" style={{ gap: 0 }}>
                <b style={{ fontWeight: 600 }}>{TPL_LABEL[k]}</b>
                <span className="muted small">{k === 'tpl_confirm' ? 'Al momento de reservar' : k === 'tpl_24h' ? 'Incluye el link para cancelar' : 'Para que llegue a tiempo'}</span>
              </span>
              <button className={`switch ${biz[autoCol] ? 'on' : ''}`} onClick={() => toggle(autoCol)} aria-pressed={biz[autoCol]} aria-label={TPL_LABEL[k]} />
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Texto del mensaje manual</h3>
          <div className="chips">
            {KINDS.map(([k, , , short]) => (
              <button key={k} className={`chip ${tplKey === k ? 'on' : ''}`} onClick={() => setTplKey(k)}>{short}</button>
            ))}
          </div>
          <textarea id="tpl" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Texto del mensaje" />
          <p className="muted small">Puedes usar: {'{cliente} {negocio} {fecha} {hora} {servicio} {profesional} {direccion} {link}'}</p>
          <div className="bubble">{fillTemplate(draft, sample)}</div>
          <div className="row">
            <button className="btn btn-pri btn-sm" onClick={() => saveTpl(draft)}>Guardar texto</button>
            <button className="btn btn-sm btn-ghost" onClick={() => { setDraft(DEFAULT_TPL[tplKey]); saveTpl(null); }}>Volver al original</button>
          </div>
          {status?.configured && <p className="muted small">El envío automático usa las plantillas aprobadas por Meta; este texto es para los envíos manuales.</p>}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="row between" style={{ padding: '16px 18px 4px' }}>
          <h3>Próximas 48 horas</h3>
          {queue && <span className={`pill ${pending ? 'due' : 'sent'}`}>{pending ? `${pending} por enviar` : 'Todo al día'}</span>}
        </div>
        {queue === null ? <p className="empty" style={{ padding: 18 }}>Cargando…</p> : !queue.length ? (
          <p className="empty" style={{ padding: 18 }}>No hay citas en las próximas 48 horas.</p>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Cita</th><th>Clienta</th>{KINDS.map(([k, , , s]) => <th key={k}>{s}</th>)}</tr></thead>
              <tbody>
                {queue.map((a) => (
                  <tr key={a.id}>
                    <td><b>{fmtDateShort(a.starts_at)}</b><div className="muted small">{fmtTime(a.starts_at)} · {staffNames[a.staff_id] || '—'}</div></td>
                    <td>{a.customer_name}<div className="muted small num">{fmtPhone(a.customer_phone)}</div></td>
                    {KINDS.map(([k, col]) => {
                      const s = stateOf(a, k, col);
                      return (
                        <td key={k}>
                          <div className="stack tight" style={{ alignItems: 'flex-start' }}>
                            <span className={`pill ${s.c}`}>{s.l}</span>
                            {s.c === 'due' && (
                              <a className="btn btn-sm btn-wa" target="_blank" rel="noopener"
                                href={waLink(a.customer_phone, fillTemplate(biz[k] || DEFAULT_TPL[k], vars(a)))}
                                onClick={() => markSent(a, col)}>Enviar</a>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {toast}
    </>
  );
}
