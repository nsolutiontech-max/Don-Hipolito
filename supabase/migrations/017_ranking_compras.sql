-- 017: Purchased-products ranking (E2 / T16). Aggregation happens in PostgreSQL;
-- owner-only. The analysis window uses America/Argentina/Buenos_Aires boundaries
-- (00:00 BA inclusive, next day 00:00 BA exclusive).
create or replace function public.ranking_compras(
  p_desde date default null,
  p_hasta date default null,
  p_categoria uuid default null,
  p_producto uuid default null,
  p_proveedor uuid default null
) returns table (
  producto_id uuid,
  producto_nombre text,
  categoria_nombre text,
  unidad_base text,
  gasto_ars numeric,
  participacion_pct numeric,
  cantidad_base numeric,
  compras bigint,
  lineas_completas bigint,
  lineas_incompletas bigint,
  ultima_compra timestamptz
) language plpgsql security invoker set search_path = '' as $$
begin
  if not public.es_dueno() then raise exception 'Access denied' using errcode = '42501'; end if;
  return query
  with filtradas as (
    select p.id as id_producto, p.nombre,
      coalesce(cat.nombre, 'Sin categoría') as categoria,
      p.unidad_medida as unidad,
      c.fecha, p.categoria_id,
      c.cantidad * c.precio_unitario as importe,
      c.cantidad_base, c.factor_a_base
    from public.compras c
    join public.productos p on p.id = c.producto_id
    left join public.categorias cat on cat.id = p.categoria_id
    where (p_desde is null or c.fecha >= (p_desde::timestamp at time zone 'America/Argentina/Buenos_Aires'))
      and (p_hasta is null
        or c.fecha < ((p_hasta + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires'))
      and (p_categoria is null or p.categoria_id = p_categoria)
      and (p_producto is null or p.id = p_producto)
      and (p_proveedor is null or c.proveedor_id = p_proveedor)
  ),
  agregada as (
    select f.id_producto, f.nombre, f.categoria, f.unidad,
      sum(f.importe) as gasto,
      count(*)::bigint as compras,
      count(*) filter (where f.factor_a_base is not null)::bigint as completas,
      count(*) filter (where f.factor_a_base is null)::bigint as incompletas,
      sum(f.cantidad_base) as base,
      max(f.fecha) as ultima
    from filtradas f
    group by f.id_producto, f.nombre, f.categoria, f.unidad
  ),
  global as (select coalesce(sum(gasto), 0) as total_gasto from agregada)
  select a.id_producto, a.nombre, a.categoria, a.unidad, a.gasto,
    case when g.total_gasto > 0 then round(a.gasto * 100 / g.total_gasto, 2) end,
    a.base, a.compras, a.completas, a.incompletas, a.ultima
  from agregada a cross join global g
  order by a.gasto desc, a.nombre;
end $$;

revoke all on function public.ranking_compras(date,date,uuid,uuid,uuid) from public, anon;
grant execute on function public.ranking_compras(date,date,uuid,uuid,uuid) to authenticated;
notify pgrst, 'reload schema';
