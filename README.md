# TuSilla

Plataforma de citas para estéticas, salones, barberías y negocios de uñas en República Dominicana.

- **Página principal** con el directorio de negocios y buscador.
- **Página de cada negocio** en `tudominio.com/nombre-del-negocio`: la clienta elige servicio, profesional, día y hora. Solo ve horas libres reales y reserva sin crear cuenta.
- **Link privado de cada cita** para verla, agregarla al calendario o cancelarla.
- **Panel del negocio**: agenda del día por profesional, citas manuales, servicios, equipo con horarios, descansos y días libres, recordatorios por WhatsApp, reportes y ajustes.
- **Recordatorios**: confirmación y avisos 24 h y 2 h antes. Funcionan a mano con un toque (se abre WhatsApp con el texto listo) o solos con la API de WhatsApp de Meta.

Tecnología: Next.js 14, Supabase (base de datos y cuentas) y Vercel (hosting).

---

## Publicarla paso a paso

Tiempo aproximado: 30 a 45 minutos. Necesitas cuentas gratis en **GitHub**, **Supabase** y **Vercel** (en Vercel puedes entrar con tu cuenta de GitHub).

### 1. Crear la base de datos en Supabase

1. Entra a [supabase.com](https://supabase.com) → **New project**.
   - Nombre: `tusilla`. Región: **East US (North Virginia)**, la más cercana a RD.
   - Guarda la contraseña de la base de datos en un lugar seguro.
2. Cuando termine de crearse, ve a **SQL Editor → New query**.
3. Abre el archivo `supabase/schema.sql`, copia todo, pégalo y toca **Run**. Debe decir *Success*.
4. Ve a **Project Settings → API** y copia tres datos (los usarás en el paso 3):
   - **Project URL**
   - **anon public** key
   - **service_role** key (es secreta: no la compartas ni la pongas en el código)

### 2. Subir el código a GitHub

1. En [github.com](https://github.com) → **New repository** → nombre `tusilla`, privado → **Create repository**.
2. En la página del repositorio vacío toca **uploading an existing file**.
3. Arrastra **el contenido** de la carpeta `tusilla` (las carpetas `app`, `components`, `lib`, `public`, `supabase` y los archivos sueltos). No subas `node_modules` ni `.env`.
4. Toca **Commit changes**.

### 3. Publicar en Vercel

1. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el repositorio `tusilla`.
2. Antes de **Deploy**, abre **Environment Variables** y agrega:

   | Nombre | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL de Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
   | `NEXT_PUBLIC_SITE_URL` | por ahora `https://tusilla.vercel.app` (cámbialo cuando sepas tu dirección final) |
   | `CRON_SECRET` | una clave larga inventada, por ejemplo 40 letras y números al azar |

3. Toca **Deploy**. Cuando termine, Vercel te da la dirección (por ejemplo `https://tusilla-xyz.vercel.app`). Si es distinta a la que pusiste en `NEXT_PUBLIC_SITE_URL`, corrígela en **Settings → Environment Variables** y vuelve a publicar (**Deployments → … → Redeploy**).

> Vercel gratis (Hobby) es para uso no comercial. Cuando empieces a cobrarle a los negocios, pasa al plan Pro o publica en Netlify, que permite uso comercial en su plan gratis.

### 4. Conectar las cuentas con tu dirección

En Supabase → **Authentication → URL Configuration**:

- **Site URL**: tu dirección de Vercel, por ejemplo `https://tusilla-xyz.vercel.app`
- **Redirect URLs**: agrega `https://tusilla-xyz.vercel.app/auth/callback`

Recomendado al inicio: en **Authentication → Providers → Email**, desactiva **Confirm email**. El correo gratis de Supabase solo manda unos pocos correos por hora y los negocios se quedarían esperando. Cuando tengas tu dominio, configura un correo propio (SMTP) y vuelve a activarlo.

### 5. Registrar la estética (primera clienta)

1. Abre tu dirección + `/registro` y crea la cuenta con el correo de la dueña (o el tuyo, si se la vas a manejar).
2. El panel te pide los datos del negocio y crea su link, por ejemplo `/estetica-luz`.
3. En el panel:
   - **Servicios**: corrige nombres, precios y duraciones; borra los de ejemplo que no ofrezca.
   - **Equipo y horarios**: agrega a cada profesional, marca qué servicios hace, su horario y descanso.
   - **Ajustes**: dirección, Instagram, color de la marca, logo y reglas (anticipación mínima, hasta cuándo se puede cancelar).
4. Haz una reserva de prueba desde el celular con tu número y mírala en la **Agenda**.
5. Comparte el link: bio de Instagram, estados de WhatsApp y el **Código QR** que está en Ajustes.

### 6. Recordatorios automáticos por WhatsApp (opcional, se puede hacer después)

Sin este paso todo funciona: en **Recordatorios** el negocio toca **Enviar** y WhatsApp se abre con el mensaje listo.

Para que salgan solos:

1. En [developers.facebook.com](https://developers.facebook.com) crea una app tipo **Business** y agrega **WhatsApp**. Conecta un número que **no** esté usando WhatsApp normal (puede ser una línea nueva). Necesitas verificar tu empresa (Grupo ENETEC, SRL o la que uses) en el Business Manager.
2. En **WhatsApp Manager → Plantillas de mensajes**, crea estas tres plantillas, categoría **Utilidad**, idioma **Español**:

   **`tusilla_cita_confirmada`**
   ```
   Hola {{1}}, tu cita en {{2}} quedó confirmada para el {{3}} a las {{4}}: {{5}} con {{6}}. Para ver o cancelar tu cita: {{7}}
   ```
   **`tusilla_recordatorio_24h`**
   ```
   Hola {{1}}, te recordamos tu cita de mañana en {{2}}: {{3}} a las {{4}} con {{5}}. Si no puedes asistir, cancela aquí: {{6}}
   ```
   **`tusilla_recordatorio_2h`**
   ```
   {{1}}, te esperamos hoy a las {{2}} en {{3}} ({{4}}). ¡Nos vemos!
   ```
   Si Meta te pide otro idioma (`es_MX`, `es_ES`), pon ese código en la variable `WA_TPL_LANG`.
3. Crea un **token permanente** (System User en Business Settings, con permiso `whatsapp_business_messaging`) y copia el **Phone number ID**.
4. En Vercel agrega `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID`, y vuelve a publicar. Desde ese momento la confirmación sale sola al reservar.
5. Para los recordatorios de 24 h y 2 h: en Supabase → **Database → Extensions** activa `pg_cron` y `pg_net`, abre `supabase/cron.sql`, cambia `TU-DOMINIO` y `TU_CRON_SECRET`, y córrelo en el SQL Editor. Cada 10 minutos revisa qué recordatorios tocan.

Meta cobra cada mensaje de plantilla (centavos de dólar por mensaje, según el país). Revisa su tabla de precios antes de activarlo para muchos negocios.

### 7. Tu propio dominio

Compra el dominio (por ejemplo en NIC.do para `.do`, o en Namecheap o Cloudflare para `.app` o `.com`). En Vercel → **Settings → Domains** agrégalo y sigue las instrucciones de DNS. Luego actualiza `NEXT_PUBLIC_SITE_URL`, el **Site URL** y las **Redirect URLs** de Supabase, y el link de `cron.sql`.

---

## Trabajar en el código en tu computadora

```bash
npm install
cp .env.example .env.local   # y llena los valores
npm run dev                  # abre http://localhost:3000
```

## Cómo está armado

```
app/
  page.js                 Portada y directorio
  [slug]/page.js          Página pública de cada negocio
  cita/[token]/page.js    Link privado de cada cita (ver o cancelar)
  registro, entrar        Cuentas de los negocios
  panel/                  Panel: agenda, servicios, equipo, recordatorios, reportes, ajustes
  api/book                Reserva y confirmación por WhatsApp
  api/cancel              Cancelación desde el link de la cita
  api/cron/reminders      Recordatorios automáticos (lo llama Supabase)
components/               Formulario de reserva y piezas del panel
lib/                      Fechas (hora de RD), formatos, Supabase y WhatsApp
supabase/schema.sql       Tablas, permisos y funciones de reserva
supabase/cron.sql         Programación de recordatorios
```

**Seguridad.** Los permisos están en la base de datos (Row Level Security): cada negocio solo ve y edita lo suyo, y el público solo puede leer servicios y horarios y reservar a través de una función que valida todo. Dos citas no pueden quedar a la misma hora con la misma profesional: la base de datos lo impide aunque dos personas reserven al mismo segundo.

## Lo que viene después (no incluido en esta versión)

- Depósitos o pagos con tarjeta (Azul o CardNet)
- Subir el logo desde el panel (por ahora se pega el link de la imagen)
- Mapa y búsqueda por cercanía, reseñas de clientas
- Planes y cobro mensual a los negocios
- Apps en App Store y Google Play (por ahora el panel se instala desde el navegador: menú → *Agregar a pantalla de inicio*)
