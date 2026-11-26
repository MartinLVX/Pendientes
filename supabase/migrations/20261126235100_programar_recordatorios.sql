create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Cada minuto, pedir a la función que envíe los recordatorios vencidos.
select cron.schedule(
  'enviar-recordatorios',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://bhjzrpabhackoonmabiu.supabase.co/functions/v1/enviar-recordatorios',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'recordatorios_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);
