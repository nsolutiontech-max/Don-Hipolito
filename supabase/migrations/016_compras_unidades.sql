-- 016: purchases with money, conversion factors and the confirmed conversion catalogue (analytical base).
-- Non-destructive: extends the purchase history instead of rewriting it, and only converts
-- rows that are provably already in the product's own base unit. Everything that cannot be
-- proven stays null and is listed for manual owner review (bandeja de datos incompletos).
-- Run once through scripts/migrate.mjs.

-- ============ Compras: money, factor evidence and base quantity ============
alter table public.compras add column moneda text not null default 'ARS';
alter table public.compras add constraint compras_moneda_check check (moneda = 'ARS');
alter table public.compras add column factor_a_base numeric;
alter table public.compras add constraint compras_factor_check check (factor_a_base > 0);
alter table public.compras add column cantidad_base numeric;
alter table public.compras add constraint compras_base_check check (cantidad_base > 0);

create index compras_proveedor_fecha on public.compras(proveedor_id, fecha desc);
create index compras_fecha on public.compras(fecha desc);

-- Deterministic backfill: only a purchase recorded in the product's own base unit
-- proves factor 1. Products without a base unit (POR_DEFINIR) stay incomplete.
update public.compras c set factor_a_base = 1, cantidad_base = c.cantidad
from public.productos p
where p.id = c.producto_id and p.unidad_medida <> 'POR_DEFINIR'
  and c.unidad_medida = p.unidad_medida and c.factor_a_base is null;

-- ============ Catálogo de conversiones confirmadas por el dueño ============
create table public.producto_unidades_compra (
  producto_id uuid not null references public.productos(id) on delete cascade,
  unidad text not null check (unidad in ('KG','UN','LT','PAQ','ATADO','CAJA')),
  factor_a_base numeric not null check (factor_a_base > 0),
  confirmada_por uuid references auth.users(id) on delete set null,
  confirmada_en timestamptz not null default now(),
  primary key (producto_id, unidad)
);
alter table public.producto_unidades_compra enable row level security;
create policy "conversiones lectura" on public.producto_unidades_compra for select to authenticated
  using (public.es_dueno_o_encargado());
create policy "conversiones dueno" on public.producto_unidades_compra for all to authenticated
  using (public.es_dueno()) with check (public.es_dueno());
-- Explicit Data API grants: Supabase stopped auto-granting public-schema tables
-- (2026-10-30), and RLS only filters rows, it never grants table privileges.
-- The conversion RPCs are security invoker, so authenticated also needs write grants.
grant select, insert, update, delete on public.producto_unidades_compra to authenticated;
grant all on public.producto_unidades_compra to service_role;

create function public.confirmar_conversion_compra(p_producto uuid, p_unidad text, p_factor numeric)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_base text;
begin
  if not public.es_dueno() then raise exception 'Access denied' using errcode = '42501'; end if;
  if p_unidad is null or p_unidad not in ('KG','UN','LT','PAQ','ATADO','CAJA') then
    raise exception 'Invalid unit';
  end if;
  if p_factor is null or p_factor <= 0 or p_factor > 1000000 then raise exception 'Invalid factor'; end if;
  select unidad_medida into v_base from public.productos where id = p_producto and activo;
  if v_base is null then raise exception 'Product not found' using errcode = 'P0002'; end if;
  if v_base = 'POR_DEFINIR' then
    raise exception 'Product has no base unit yet' using errcode = '23513';
  end if;
  if p_unidad = v_base then
    raise exception 'Conversion unit must differ from the product base unit';
  end if;
  insert into public.producto_unidades_compra(producto_id, unidad, factor_a_base, confirmada_por)
    values (p_producto, p_unidad, p_factor, auth.uid())
    on conflict (producto_id, unidad) do update
      set factor_a_base = excluded.factor_a_base, confirmada_por = excluded.confirmada_por,
          confirmada_en = now();
end $$;

create function public.quitar_conversion_compra(p_producto uuid, p_unidad text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not public.es_dueno() then raise exception 'Access denied' using errcode = '42501'; end if;
  delete from public.producto_unidades_compra
    where producto_id = p_producto and unidad = p_unidad;
  if not found then raise exception 'Conversion not found' using errcode = 'P0002'; end if;
end $$;

-- Manual owner review of an incomplete historical purchase: records the factor as evidence
-- and recomputes the base quantity. Historical purchases keep their own stored factor.
create function public.corregir_compra_incompleta(p_compra uuid, p_factor numeric)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not public.es_dueno() then raise exception 'Access denied' using errcode = '42501'; end if;
  if p_factor is null or p_factor <= 0 or p_factor > 1000000 then raise exception 'Invalid factor'; end if;
  update public.compras set factor_a_base = p_factor, cantidad_base = cantidad * p_factor
    where id = p_compra;
  if not found then raise exception 'Purchase not found' using errcode = 'P0002'; end if;
end $$;

-- ============ Compras: registrar with confirmed conversions ============
drop function public.registrar_compra(uuid,uuid,numeric,text,numeric,timestamptz);
create function public.registrar_compra(
  p_producto uuid, p_proveedor uuid, p_cantidad numeric, p_unidad text,
  p_precio numeric, p_fecha timestamptz
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_mov uuid; v_compra uuid; v_responsable uuid; v_proveedor text;
  v_base_unidad text; v_factor numeric; v_base numeric;
begin
  if not public.es_dueno_o_encargado() then raise exception 'Access denied' using errcode = '42501'; end if;
  if p_cantidad is null or p_cantidad <= 0 then raise exception 'Invalid quantity'; end if;
  if p_precio is null or p_precio < 0 then raise exception 'Invalid price'; end if;
  if p_unidad is null or p_unidad not in ('KG','UN','LT','PAQ','ATADO','CAJA') then
    raise exception 'Invalid unit';
  end if;
  if not exists (select 1 from public.productos where id = p_producto and activo) then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;
  select nombre into v_proveedor from public.proveedores where id = p_proveedor and activo;
  if v_proveedor is null then raise exception 'Provider not found' using errcode = 'P0002'; end if;
  select unidad_medida into v_base_unidad from public.productos where id = p_producto;
  v_factor := null; v_base := null;
  if v_base_unidad <> 'POR_DEFINIR' then
    if p_unidad = v_base_unidad then
      v_factor := 1; v_base := p_cantidad;
    else
      select u.factor_a_base into v_factor from public.producto_unidades_compra u
        where u.producto_id = p_producto and u.unidad = p_unidad;
      if v_factor is not null then v_base := p_cantidad * v_factor; end if;
    end if;
  end if;
  select responsable_id into v_responsable from public.usuarios where id = auth.uid() and activo;
  insert into public.movimientos(producto_id, tipo, cantidad, motivo, fecha, responsable_id)
    values (p_producto, 'INGRESO', p_cantidad, 'Compra a ' || v_proveedor,
      coalesce(p_fecha, now()), v_responsable)
    returning id into v_mov;
  insert into public.compras(producto_id, proveedor_id, fecha, cantidad, unidad_medida,
    precio_unitario, responsable_id, movimiento_id, factor_a_base, cantidad_base)
    values (p_producto, p_proveedor, coalesce(p_fecha, now()), p_cantidad, p_unidad,
      p_precio, v_responsable, v_mov, v_factor, v_base)
    returning id into v_compra;
  return v_compra;
end $$;

revoke all on function public.confirmar_conversion_compra(uuid,text,numeric),
  public.quitar_conversion_compra(uuid,text), public.corregir_compra_incompleta(uuid,numeric),
  public.registrar_compra(uuid,uuid,numeric,text,numeric,timestamptz) from public, anon;
grant execute on function public.confirmar_conversion_compra(uuid,text,numeric),
  public.quitar_conversion_compra(uuid,text), public.corregir_compra_incompleta(uuid,numeric),
  public.registrar_compra(uuid,uuid,numeric,text,numeric,timestamptz) to authenticated;
notify pgrst, 'reload schema';
