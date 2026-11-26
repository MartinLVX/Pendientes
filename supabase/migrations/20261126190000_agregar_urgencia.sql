-- Nivel de urgencia de cada pendiente: 1 = baja, 2 = media, 3 = alta.
alter table public.pendientes
  add column urgencia smallint not null default 2 check (urgencia between 1 and 3);
comment on column public.pendientes.urgencia is '1 = baja, 2 = media, 3 = alta';
