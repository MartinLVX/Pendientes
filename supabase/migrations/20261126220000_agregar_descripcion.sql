-- Descripción opcional con más detalle de cada pendiente.
alter table public.pendientes
  add column descripcion text check (descripcion is null or char_length(descripcion) <= 2000);
