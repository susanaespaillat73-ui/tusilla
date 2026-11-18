// Nombre de la plataforma. Para cambiarlo: variable NEXT_PUBLIC_BRAND_NAME en Vercel y Redeploy.
export const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME || 'TuSilla';
export const BRAND_MARK =
  BRAND.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ ]/g, '')
    .split(/\s+|(?=[A-ZÁÉÍÓÚÑ])/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || BRAND.slice(0, 2).toUpperCase();
export const SITE_HOST = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/^https?:\/\//, '');
