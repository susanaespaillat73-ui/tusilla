import './globals.css';

const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata = {
  metadataBase: new URL(site),
  title: { default: 'TuSilla · Citas para estéticas, salones y barberías', template: '%s · TuSilla' },
  description:
    'Reserva tu cita en estéticas, salones y barberías de República Dominicana. Elige servicio, profesional y hora, y recibe la confirmación por WhatsApp.',
  openGraph: { siteName: 'TuSilla', locale: 'es_DO', type: 'website' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FBFAFC' },
    { media: '(prefers-color-scheme: dark)', color: '#141019' },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="es-DO">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
