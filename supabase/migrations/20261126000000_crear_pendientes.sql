-- Tabla de pendientes: cada fila pertenece a un usuario.
create table public.pendientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 500),
  hecho boolean not null default false,
  created_at timestamptz not null default now()
);

create index pendientes_user_id_idx on public.pendientes (user_id, created_at desc);

-- Seguridad: cada usuario solo puede ver y cambiar sus propios pendientes.
alter table public.pendientes enable row level security;

create policy "Ver mis pendientes" on public.pendientes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Crear mis pendientes" on public.pendientes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Editar mis pendientes" on public.pendientes
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Borrar mis pendientes" on public.pendientes
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Sincronización en tiempo real entre celular y escritorio.
alter publication supabase_realtime add table public.pendientes;
