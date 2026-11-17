-- =====================================================================
-- Envío automático de recordatorios (solo cuando ya conectaste WhatsApp)
-- 1. Supabase → Database → Extensions: activa "pg_cron" y "pg_net".
-- 2. Cambia TU-DOMINIO y TU_CRON_SECRET (el mismo valor que pusiste en Vercel).
-- 3. Pega esto en SQL Editor → Run.
-- =====================================================================

select cron.schedule(
  'tusilla-recordatorios',
  '*/10 * * * *',   -- cada 10 minutos
  $$
  select net.http_get(
    url := 'https://TU-DOMINIO/api/cron/reminders',
    headers := jsonb_build_object('Authorization', 'Bearer TU_CRON_SECRET'),
    timeout_milliseconds := 30000
  );
  $$
);

-- Para ver si está corriendo:
--   select * from cron.job_run_details order by start_time desc limit 10;
-- Para detenerlo:
--   select cron.unschedule('tusilla-recordatorios');
