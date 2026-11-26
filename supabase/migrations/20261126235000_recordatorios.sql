-- Recordatorio opcional por pendiente
alter table public.pendientes
  add column recordar_en timestamptz,
  add column recordado boolean not null default false;

create index pendientes_recordar_idx on public.pendientes (recordar_en)
  where recordar_en is not null and not recordado and not hecho;

-- Dispositivos que aceptaron notificaciones (Web Push)
create table public.push_suscripciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index push_suscripciones_user_idx on public.push_suscripciones (user_id);

alter table public.push_suscripciones enable row level security;
create policy "Ver mis dispositivos" on public.push_suscripciones
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Borrar mis dispositivos" on public.push_suscripciones
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Guarda (o reasigna) la suscripción de este dispositivo al usuario actual.
create or replace function public.guardar_suscripcion(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  insert into public.push_suscripciones (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
end; $$;
revoke execute on function public.guardar_suscripcion(text, text, text) from public, anon;
grant execute on function public.guardar_suscripcion(text, text, text) to authenticated;

-- Toma los recordatorios vencidos y los marca como enviados (solo el servidor).
create or replace function public.tomar_recordatorios_vencidos()
returns table (id uuid, user_id uuid, texto text, descripcion text)
language sql security definer set search_path = '' as $$
  update public.pendientes p set recordado = true
   where p.id in (
     select x.id from public.pendientes x
      where x.recordar_en is not null and x.recordar_en <= now()
        and not x.recordado and not x.hecho
      order by x.recordar_en limit 200 for update skip locked)
  returning p.id, p.user_id, p.texto, p.descripcion;
$$;
revoke execute on function public.tomar_recordatorios_vencidos() from public, anon, authenticated;
grant execute on function public.tomar_recordatorios_vencidos() to service_role;

-- Claves del servidor de notificaciones, leídas del Vault (solo el servidor).
-- Los valores se crearon aparte con vault.create_secret: vapid_public, vapid_private,
-- recordatorios_cron_secret. No se guardan en el repositorio.
create or replace function public.config_recordatorios()
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_object_agg(name, decrypted_secret) from vault.decrypted_secrets
   where name in ('vapid_public', 'vapid_private', 'recordatorios_cron_secret');
$$;
revoke execute on function public.config_recordatorios() from public, anon, authenticated;
grant execute on function public.config_recordatorios() to service_role;
