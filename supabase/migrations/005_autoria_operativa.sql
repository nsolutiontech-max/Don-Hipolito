-- Use the authenticated identity even for writes made directly through PostgREST.
create function public.asignar_responsable_sesion() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  select responsable_id into new.responsable_id from public.usuarios where id=auth.uid() and activo;
  return new;
end $$;
create trigger responsable_registro before insert or update on public.actividad_registros
  for each row execute function public.asignar_responsable_sesion();
create trigger responsable_movimiento before insert or update on public.movimientos
  for each row execute function public.asignar_responsable_sesion();
create trigger responsable_compra before insert or update on public.compras
  for each row execute function public.asignar_responsable_sesion();
create trigger responsable_pedido before insert or update on public.pedidos
  for each row execute function public.asignar_responsable_sesion();

create or replace function public.es_dueno() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.rol_actual()='DUEÑO', false)
$$;
revoke all on function public.es_dueno() from public,anon;
grant execute on function public.es_dueno() to authenticated;
