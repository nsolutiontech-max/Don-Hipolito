-- Close/reopen daily inventories: closed inventories are protected at DB level.
alter table public.inventarios
  add column estado text not null default 'ABIERTO' check (estado in ('ABIERTO','CERRADO')),
  add column cerrado_por uuid references public.usuarios(id),
  add column cerrado_en timestamptz,
  add column motivo_apertura text not null default '';

-- Real-time inventories already exist; every paused record stays ABIERTO.

-- Detail writes on a closed inventory are rejected outright.
create function public.proteger_inventario_cerrado_detalles() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare v_estado text;
begin
  select estado into v_estado from public.inventarios
    where id = coalesce(new.inventario_id, old.inventario_id);
  if v_estado = 'CERRADO' then
    raise exception 'El inventario esta cerrado; reabralo para editar sus detalles';
  end if;
  return coalesce(new, old);
end $$;

create trigger inventario_cerrado_detalles
  before insert or update or delete on public.inventario_detalles
  for each row execute function public.proteger_inventario_cerrado_detalles();

-- The inventory row itself only admits closing and reopening, and reopening is exclusive to the owner.
create function public.proteger_inventario_cerrado() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if old.estado = 'CERRADO' and new.estado = 'CERRADO' then
    raise exception 'El inventario esta cerrado; reabralo antes de modificarlo';
  end if;
  if old.estado = 'CERRADO' and new.estado = 'ABIERTO'
     and not exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'DUEÑO' and u.activo) then
    raise exception 'Solo el dueno puede reabrir un inventario cerrado';
  end if;
  return new;
end $$;

create trigger inventario_cerrado_guardia
  before update on public.inventarios
  for each row execute function public.proteger_inventario_cerrado();
