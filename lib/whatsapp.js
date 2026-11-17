// Envío por la WhatsApp Cloud API de Meta, con plantillas aprobadas.
// Si no hay WHATSAPP_TOKEN, no se envía nada y el panel ofrece el envío manual.
import { digits, fmtDateLong, fmtTime } from './format';

const API = 'https://graph.facebook.com/v21.0';

export const waConfigured = () =>
  Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

export const WA_TEMPLATES = {
  confirm: process.env.WA_TPL_CONFIRM || 'tusilla_cita_confirmada',
  r24: process.env.WA_TPL_24H || 'tusilla_recordatorio_24h',
  r2: process.env.WA_TPL_2H || 'tusilla_recordatorio_2h',
};

/**
 * Variables de cada plantilla. El orden debe coincidir con {{1}}, {{2}}… del texto
 * aprobado en Meta (ver README).
 */
export function templateParams(kind, a) {
  const first = (a.customer_name || '').split(' ')[0];
  const fecha = fmtDateLong(a.starts_at);
  const hora = fmtTime(a.starts_at);
  const pro = a.staff_name || 'nuestro equipo';
  if (kind === 'confirm') return [first, a.business_name, fecha, hora, a.service_name, pro, a.link];
  if (kind === 'r24') return [first, a.business_name, a.service_name, hora, pro, a.link];
  return [first, hora, a.business_name, a.address || a.business_name];
}

export async function sendWhatsAppTemplate(kind, appt) {
  if (!waConfigured()) return { ok: false, skipped: true };
  const params = templateParams(kind, appt).map((t) => ({ type: 'text', text: String(t || '-').slice(0, 900) }));
  try {
    const res = await fetch(`${API}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: '1' + digits(appt.customer_phone),
        type: 'template',
        template: {
          name: WA_TEMPLATES[kind],
          language: { code: process.env.WA_TPL_LANG || 'es' },
          components: [{ type: 'body', parameters: params }],
        },
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json?.error?.message || `HTTP ${res.status}` };
    return { ok: true, id: json?.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
