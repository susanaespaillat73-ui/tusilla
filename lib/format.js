// Utilidades de fecha, dinero, teléfono y textos. República Dominicana: UTC-4 todo el año.
export const TZ = 'America/Santo_Domingo';
export const OFFSET = '-04:00';

export const CATEGORIES = {
  estetica: 'Estética',
  salon: 'Salón de belleza',
  barberia: 'Barbería',
  unas: 'Uñas',
  spa: 'Spa',
  cejas: 'Cejas y pestañas',
};

export const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const DOW_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const pad = (n) => String(n).padStart(2, '0');

/** Fecha de hoy (o de d) en RD como 'YYYY-MM-DD'. */
export function drDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
const noon = (s) => new Date(`${s}T12:00:00${OFFSET}`);
export function addDays(s, n) {
  const d = noon(s);
  d.setUTCDate(d.getUTCDate() + n);
  return drDate(d);
}
export const weekdayOf = (s) => noon(s).getUTCDay();
export const dayNum = (s) => Number(s.slice(8, 10));
export const toISO = (date, hhmm) => new Date(`${date}T${hhmm}:00${OFFSET}`).toISOString();

/** 'HH:MM' en hora de RD a partir de un ISO. */
export function hhmm(iso) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}
export function h12(hm) {
  let [h, m] = hm.split(':').map(Number);
  const ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${pad(m)} ${ap}`;
}
export const fmtTime = (iso) => h12(hhmm(iso));
export const timeShort = (t) => (t || '').slice(0, 5); // '09:00:00' → '09:00'

export function fmtDateLong(dateOrIso) {
  const d = dateOrIso.length === 10 ? noon(dateOrIso) : new Date(dateOrIso);
  return new Intl.DateTimeFormat('es-DO', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(d);
}
export function fmtDateShort(dateOrIso) {
  const d = dateOrIso.length === 10 ? noon(dateOrIso) : new Date(dateOrIso);
  return new Intl.DateTimeFormat('es-DO', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(d);
}
export const monthShort = (s) =>
  new Intl.DateTimeFormat('es-DO', { timeZone: TZ, month: 'short' }).format(noon(s)).replace('.', '');
export const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export const money = (n) => 'RD$' + Math.round(Number(n || 0)).toLocaleString('en-US');

export function digits(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.length === 11 && d[0] === '1') d = d.slice(1);
  return d;
}
export const validPhone = (p) => /^(809|829|849)\d{7}$/.test(digits(p));
export function fmtPhone(p) {
  const d = digits(p);
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : p;
}
export const waLink = (phone, msg = '') =>
  `https://wa.me/1${digits(phone)}${msg ? '?text=' + encodeURIComponent(msg) : ''}`;

export function slugify(s) {
  return (
    String(s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/g, '') || 'mi-negocio'
  );
}

/** Mientras se escribe: deja escribir guiones; slugify() limpia al guardar. */
export function slugInput(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .slice(0, 40);
}

/** Texto blanco u oscuro según el color de fondo. */
export function contrastText(hex) {
  const h = (hex || '#B8336A').replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? '#1B1424' : '#FFFFFF';
}

export const DEFAULT_TPL = {
  tpl_confirm:
    'Hola {cliente} 👋 Tu cita en {negocio} quedó confirmada.\n📅 {fecha} a las {hora}\n✨ {servicio} con {profesional}\n📍 {direccion}\nVer o cancelar: {link}',
  tpl_24h:
    'Hola {cliente}, te recordamos tu cita de mañana en {negocio}: {servicio} a las {hora} con {profesional}. Si no puedes venir, cancela aquí: {link}',
  tpl_2h: '{cliente}, te esperamos hoy a las {hora} en {negocio} 💆‍♀️ ¡Nos vemos!',
};
export const TPL_LABEL = {
  tpl_confirm: 'Confirmación al reservar',
  tpl_24h: 'Recordatorio 24 horas antes',
  tpl_2h: 'Recordatorio 2 horas antes',
};

export function fillTemplate(tpl, v) {
  return String(tpl || '')
    .replace(/\{cliente\}/g, (v.customer_name || '').split(' ')[0])
    .replace(/\{negocio\}/g, v.business_name || '')
    .replace(/\{fecha\}/g, fmtDateLong(v.starts_at))
    .replace(/\{hora\}/g, fmtTime(v.starts_at))
    .replace(/\{servicio\}/g, v.service_name || '')
    .replace(/\{profesional\}/g, v.staff_name || 'nuestro equipo')
    .replace(/\{direccion\}/g, v.address || '')
    .replace(/\{link\}/g, v.link || '');
}

export const STATUS = {
  confirmed: 'Confirmada',
  completed: 'Atendida',
  no_show: 'No vino',
  cancelled: 'Cancelada',
};

export const BOOKING_ERRORS = {
  slot_taken: 'Esa hora se acaba de ocupar. Elige otra.',
  invalid_phone: 'El WhatsApp debe tener 10 dígitos y empezar por 809, 829 u 849.',
  invalid_name: 'Escribe tu nombre y apellido.',
  too_many_bookings: 'Ya tienes 3 citas pendientes en este negocio. Escríbeles por WhatsApp si necesitas otra.',
  business_not_found: 'Este negocio no está recibiendo reservas en este momento.',
  service_not_found: 'Ese servicio ya no está disponible.',
  cannot_cancel: 'Esta cita ya no se puede cancelar en línea. Escríbele al negocio por WhatsApp.',
};

/** Servicios de ejemplo para arrancar, según el tipo de negocio. */
export const STARTER_SERVICES = {
  estetica: [
    ['Limpieza facial profunda', 60, 1800],
    ['Hidrafacial', 60, 3500],
    ['Diseño y depilación de cejas', 30, 500],
    ['Lifting de pestañas', 60, 1500],
    ['Masaje relajante', 60, 2200],
    ['Depilación con cera (piernas)', 45, 1200],
  ],
  salon: [
    ['Lavado y blower', 60, 900],
    ['Corte de dama', 45, 800],
    ['Tinte completo', 120, 3200],
    ['Alisado con keratina', 150, 4500],
    ['Manicure', 45, 600],
    ['Pedicure', 60, 800],
  ],
  barberia: [
    ['Corte clásico', 30, 400],
    ['Corte + barba', 45, 600],
    ['Fade / degradado', 40, 500],
    ['Arreglo de barba', 20, 250],
    ['Corte de niño', 30, 300],
  ],
  unas: [
    ['Manicure tradicional', 45, 500],
    ['Pedicure spa', 60, 850],
    ['Uñas acrílicas', 90, 1500],
    ['Gel / semipermanente', 60, 900],
    ['Retiro de acrílico', 30, 400],
  ],
  spa: [
    ['Masaje relajante', 60, 2200],
    ['Masaje descontracturante', 60, 2500],
    ['Facial hidratante', 60, 2000],
    ['Exfoliación corporal', 45, 1800],
  ],
  cejas: [
    ['Diseño de cejas', 30, 500],
    ['Laminado de cejas', 45, 1500],
    ['Lifting de pestañas', 60, 1500],
    ['Extensiones de pestañas', 120, 2800],
  ],
};
