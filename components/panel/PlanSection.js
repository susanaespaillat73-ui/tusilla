'use client';
import { usePanel } from '@/components/panel/PanelContext';
import { ACCOUNT_STATE, fmtDateLong, fmtDateShort, money, waLink } from '@/lib/format';
import { BRAND } from '@/lib/brand';

const PILL = { trial: 'confirmed', active: 'completed', grace: 'no_show', expired: 'cancelled', suspended: 'cancelled' };

export default function PlanSection() {
  const { account: a, biz } = usePanel();
  if (!a) return <div className="card" id="plan"><h3>Mi plan</h3><p className="muted">Cargando…</p></div>;

  const plan = a.plan || {};
  const until =
    a.state === 'trial' ? `Prueba gratis hasta el ${fmtDateLong(a.trial_ends_at)}`
    : a.paid_until ? `Pagado hasta el ${fmtDateLong(a.paid_until)}`
    : 'Sin pagos registrados';
  const contact = a.support_whatsapp
    ? waLink(a.support_whatsapp, `Hola, soy de ${biz.name} (${biz.slug}). Quiero pagar o cambiar mi plan de ${BRAND}.`)
    : null;

  return (
    <div className="card stack" id="plan">
      <div className="row between">
        <h3>Mi plan</h3>
        <span className={`pill ${PILL[a.state]}`}>{ACCOUNT_STATE[a.state]}</span>
      </div>
      <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="stat"><small>Plan</small><b>{plan.name}</b><span className="muted small">{money(plan.price)} al mes</span></div>
        <div className="stat"><small>Profesionales activas</small><b>{a.staff_active} de {a.staff_limit}</b>{a.state === 'trial' && <span className="muted small">Límite durante la prueba</span>}</div>
        <div className="stat"><small>Vigencia</small><b style={{ fontSize: '1.05rem' }}>{until}</b></div>
      </div>

      <div className="stack tight">
        <b>Planes disponibles</b>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Plan</th><th>Profesionales</th><th className="r">Precio al mes</th></tr></thead>
            <tbody>
              {(a.plans || []).map((p) => (
                <tr key={p.id} style={p.id === plan.id ? { fontWeight: 700 } : undefined}>
                  <td>{p.name}{p.id === plan.id ? ' (tu plan)' : ''}</td>
                  <td>{p.max_staff === 1 ? '1' : `Hasta ${p.max_staff}`}</td>
                  <td className="r">{money(p.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="stack tight">
        <b>Cómo pagar o cambiar de plan</b>
        <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{a.payment_instructions}</p>
        {contact && (
          <div><a className="btn btn-wa btn-sm" href={contact} target="_blank" rel="noopener">Escribir por WhatsApp</a></div>
        )}
      </div>

      {a.payments?.length > 0 && (
        <div className="stack tight">
          <b>Pagos registrados</b>
          {a.payments.map((p, i) => (
            <div key={i} className="line-row small">
              <span>{fmtDateShort(p.created_at)} · {p.months} {p.months === 1 ? 'mes' : 'meses'} · {p.method}</span>
              <span className="num"><b>{money(p.amount)}</b> · cubre hasta {fmtDateShort(p.period_end)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
