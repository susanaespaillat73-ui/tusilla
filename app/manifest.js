import { BRAND } from '@/lib/brand';

export default function manifest() {
  return {
    name: `${BRAND} · Panel del negocio`,
    short_name: BRAND,
    description: 'Agenda y reservas para estéticas, salones y barberías.',
    start_url: '/panel',
    display: 'standalone',
    background_color: '#FBFAFC',
    theme_color: '#B8336A',
    lang: 'es-DO',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };
}
