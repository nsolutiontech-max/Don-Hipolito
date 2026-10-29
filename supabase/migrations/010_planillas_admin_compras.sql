-- 010: owner-managed planillas (soft archive + ordering) and atomic purchases.
-- Run once through scripts/migrate.mjs.

-- ============ Planillas: soft archive ============
alter table public.planilla_secciones add column activo boolean not null default true;
alter table public.planilla_items add column activo boolean not null default true;

-- Active-scoped uniqueness: archived rows never block re-adding a name/product,
-- and item order becomes per section instead of global.
alter table public.planilla_secciones drop constraint planilla_secciones_planilla_id_nombre_key;
alter table public.planilla_items drop constraint planilla_items_planilla_id_producto_id_key;
alter table public.planilla_items drop constraint planilla_items_planilla_id_orden_key;

create unique index planilla_secciones_nombre_activo
  on public.planilla_secciones(planilla_id, nombre) where activo;
create unique index planilla_items_producto_activo
  on public.planilla_items(planilla_id, producto_id) where activo;
create unique index planilla_items_orden_seccion_activo
  on public.planilla_items(planilla_id, seccion_id, orden) where activo;

-- ============ Planillas: owner mutations ============
create function public.agregar_seccion_planilla(p_planilla uuid, p_nombre text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_orden int;
begin
  if not public.es_dueno() then raise exception 'Access denied' using errcode = '42501'; end if;
  if p_nombre is null or length(btrim(p_nombre)) = 0 or length(p_nombre) > 80 then
    raise exception 'Invalid section name';
  end if;
  if not exists (select 1 from public.planillas_inventario where id = p_planilla and activo) then
    raise exception 'Planilla not found' using errcode = 'P0002';
  end if;
  select coalesce(max(orden), 0) + 1 into v_orden
    from public.planilla_secciones where planilla_id = p_planilla and activo;
  insert into public.planilla_secciones(planilla_id, nombre, orden)
    values (p_planilla, btrim(p_nombre), v_orden)
    returning id into v_id;
  return v_id;
end $$;

create function public.archivar_seccion_planilla(p_seccion uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not public.es_dueno() then raise exception 'Access denied' using errcode = '42501'; end if;
  if not exists (select 1 from public.planilla_secciones where id = p_seccion and activo) then
    raise exception 'Section not found' using errcode = 'P0002';
  end if;
  update public.planilla_items set activo = false where seccion_id = p_seccion and activo;
  update public.planilla_secciones set activo = false where id = p_seccion;
end $$;

create function public.agregar_item_planilla(p_planilla uuid, p_seccion uuid, p_producto uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_orden int;
begin
  if not public.es_dueno() then raise exception 'Access denied' using errcode = '42501'; end if;
  if not exists (select 1 from public.planilla_secciones
    where id = p_seccion and planilla_id = p_planilla and activo) then
    raise exception 'Section not found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.productos where id = p_producto and activo) then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.planilla_items
    where planilla_id = p_planilla and producto_id = p_producto and activo) then
    raise exception 'Product already in this planilla' using errcode = '23505';
  end if;
  select coalesce(max(orden), 0) + 1 into v_orden from public.planilla_items
    where planilla_id = p_planilla and seccion_id = p_seccion and activo;
  insert into public.planilla_items(planilla_id, seccion_id, producto_id, orden)
    values (p_planilla, p_seccion, p_producto, v_orden)
    returning id into v_id;
  return v_id;
end $$;

create function public.archivar_item_planilla(p_item uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not public.es_dueno() then raise exception 'Access denied' using errcode = '42501'; end if;
  update public.planilla_items set activo = false where id = p_item and activo;
  if not found then raise exception 'Item not found' using errcode = 'P0002'; end if;
end $$;

-- Reorder every active section of a planilla by the supplied id order.
create function public.reordenar_secciones_planilla(p_planilla uuid, p_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not public.es_dueno() then raise exception 'Access denied' using errcode = '42501'; end if;
  if p_ids is null or array_length(p_ids, 1) is null then raise exception 'Invalid order'; end if;
  if (select count(*) from public.planilla_secciones where planilla_id = p_planilla and activo) <> array_length(p_ids, 1)
    or (select count(distinct id) from unnest(p_ids) id) <> array_length(p_ids, 1)
    or exists (select 1 from unnest(p_ids) id where not exists (
      select 1 from public.planilla_secciones s
      where s.id = id and s.planilla_id = p_planilla and s.activo)) then
    raise exception 'Order does not match active sections';
  end if;
  update public.planilla_secciones s set orden = o.pos
    from (select id, ordinality::int as pos from unnest(p_ids) with ordinality as t(id, ordinality)) o
    where s.id = o.id and s.planilla_id = p_planilla;
end $$;

-- Reorder active items inside one section. The offset step respects the
-- active-scoped unique order while rows are being reassigned.
create function public.reordenar_items_planilla(p_planilla uuid, p_seccion uuid, p_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not public.es_dueno() then raise exception 'Access denied' using errcode = '42501'; end if;
  if p_ids is null or array_length(p_ids, 1) is null then raise exception 'Invalid order'; end if;
  if (select count(*) from public.planilla_items
      where planilla_id = p_planilla and seccion_id = p_seccion and activo) <> array_length(p_ids, 1)
    or (select count(distinct id) from unnest(p_ids) id) <> array_length(p_ids, 1)
    or exists (select 1 from unnest(p_ids) id where not exists (
      select 1 from public.planilla_items i
      where i.id = id and i.planilla_id = p_planilla and i.seccion_id = p_seccion and i.activo)) then
    raise exception 'Order does not match active items';
  end if;
  update public.planilla_items set orden = orden + 100000
    where planilla_id = p_planilla and seccion_id = p_seccion and activo;
  update public.planilla_items i set orden = o.pos
    from (select id, ordinality::int as pos from unnest(p_ids) with ordinality as t(id, ordinality)) o
    where i.id = o.id and i.planilla_id = p_planilla and i.seccion_id = p_seccion;
end $$;

-- ============ Compras: atomic purchase + movement ============
-- The legacy uniqueness blocked legitimate repeated purchases of the same
-- product/provider/price; drop it by matching its columns, not its generated name.
do $$ declare v_name text; begin
  select conname into v_name from pg_constraint
    where conrelid = 'public.compras'::regclass and contype = 'u'
      and conkey = (select array_agg(attnum order by attnum) from pg_attribute
        where attrelid = 'public.compras'::regclass
          and attname in ('producto_id','proveedor_id','fecha','precio_unitario'));
  if v_name is not null then
    execute format('alter table public.compras drop constraint %I', v_name);
  end if;
end $$;

alter table public.compras alter column cantidad set not null;
alter table public.compras add constraint compras_cantidad_check check (cantidad > 0);
alter table public.compras add constraint compras_unidad_check
  check (unidad_medida in ('KG','UN','LT','PAQ','ATADO','CAJA'));

create function public.registrar_compra(
  p_producto uuid, p_proveedor uuid, p_cantidad numeric, p_unidad text,
  p_precio numeric, p_fecha timestamptz
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_mov uuid; v_compra uuid; v_responsable uuid; v_proveedor text;
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
  select responsable_id into v_responsable from public.usuarios where id = auth.uid() and activo;
  insert into public.movimientos(producto_id, tipo, cantidad, motivo, fecha, responsable_id)
    values (p_producto, 'INGRESO', p_cantidad, 'Compra a ' || v_proveedor,
      coalesce(p_fecha, now()), v_responsable)
    returning id into v_mov;
  insert into public.compras(producto_id, proveedor_id, fecha, cantidad, unidad_medida,
    precio_unitario, responsable_id, movimiento_id)
    values (p_producto, p_proveedor, coalesce(p_fecha, now()), p_cantidad, p_unidad,
      p_precio, v_responsable, v_mov)
    returning id into v_compra;
  return v_compra;
end $$;

-- Archived products must stop producing order lines from stale counts.
create or replace function public.crear_pedido_con_items(p_inventario_id uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_inv public.inventarios; v_id uuid; begin
  if not public.es_dueno_o_encargado() then raise exception 'Access denied' using errcode = '42501'; end if;
  select * into strict v_inv from public.inventarios where id = p_inventario_id for update;
  if not exists (select 1 from public.planillas_inventario where id = v_inv.planilla_id and modo = 'STOCK_PEDIDO') then
    raise exception 'Orders are not available for this inventory';
  end if;
  select id into v_id from public.pedidos where inventario_id = p_inventario_id;
  if found then return v_id; end if;
  insert into public.pedidos(fecha, inventario_id, responsable_id, creado_por)
    values (v_inv.fecha, v_inv.id, v_inv.responsable_id, auth.uid()) returning id into v_id;
  insert into public.pedido_items(pedido_id, producto_id, cantidad)
    select v_id, d.producto_id, d.cantidad_pedida from public.inventario_detalles d
    where d.inventario_id = p_inventario_id and d.ubicacion = 'GENERAL'
      and d.stock_real is not null and d.cantidad_pedida > 0
      and exists (select 1 from public.planilla_items i
        where i.planilla_id = v_inv.planilla_id and i.producto_id = d.producto_id and i.activo);
  if not found then raise exception 'No counted products with order quantities'; end if;
  return v_id;
end $$;

revoke all on function public.agregar_seccion_planilla(uuid,text),
  public.archivar_seccion_planilla(uuid), public.agregar_item_planilla(uuid,uuid,uuid),
  public.archivar_item_planilla(uuid), public.reordenar_secciones_planilla(uuid,uuid[]),
  public.reordenar_items_planilla(uuid,uuid,uuid[]),
  public.registrar_compra(uuid,uuid,numeric,text,numeric,timestamptz) from public, anon;
grant execute on function public.agregar_seccion_planilla(uuid,text),
  public.archivar_seccion_planilla(uuid), public.agregar_item_planilla(uuid,uuid,uuid),
  public.archivar_item_planilla(uuid), public.reordenar_secciones_planilla(uuid,uuid[]),
  public.reordenar_items_planilla(uuid,uuid,uuid[]),
  public.registrar_compra(uuid,uuid,numeric,text,numeric,timestamptz) to authenticated;
notify pgrst, 'reload schema';
