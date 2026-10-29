-- 011: restore stable catalogue upsert targets and add un-archive semantics.
-- 010 replaced two global uniqueness constraints with active-scoped indexes, which
-- broke seed/catalogue upserts using ON CONFLICT (planilla_id, producto_id) and
-- (planilla_id, nombre). Archived rows now get reactivated instead of reinserted.
alter table public.planilla_secciones add constraint planilla_secciones_planilla_id_nombre_key unique (planilla_id, nombre);
alter table public.planilla_items add constraint planilla_items_planilla_id_producto_id_key unique (planilla_id, producto_id);
drop index if exists planilla_secciones_nombre_activo;
drop index if exists planilla_items_producto_activo;

create or replace function public.agregar_seccion_planilla(p_planilla uuid, p_nombre text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_activo boolean; v_orden int;
begin
  if not public.es_dueno() then raise exception 'Access denied' using errcode = '42501'; end if;
  if p_nombre is null or length(btrim(p_nombre)) = 0 or length(p_nombre) > 80 then
    raise exception 'Invalid section name';
  end if;
  if not exists (select 1 from public.planillas_inventario where id = p_planilla and activo) then
    raise exception 'Planilla not found' using errcode = 'P0002';
  end if;
  select id, activo into v_id, v_activo from public.planilla_secciones
    where planilla_id = p_planilla and nombre = btrim(p_nombre);
  if found then
    if v_activo then raise exception 'Section already exists' using errcode = '23505'; end if;
    select coalesce(max(orden), 0) + 1 into v_orden
      from public.planilla_secciones where planilla_id = p_planilla and activo;
    update public.planilla_secciones set activo = true, orden = v_orden where id = v_id;
    return v_id;
  end if;
  select coalesce(max(orden), 0) + 1 into v_orden
    from public.planilla_secciones where planilla_id = p_planilla and activo;
  insert into public.planilla_secciones(planilla_id, nombre, orden)
    values (p_planilla, btrim(p_nombre), v_orden)
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.agregar_item_planilla(p_planilla uuid, p_seccion uuid, p_producto uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_activo boolean; v_orden int; v_existe boolean;
begin
  if not public.es_dueno() then raise exception 'Access denied' using errcode = '42501'; end if;
  if not exists (select 1 from public.planilla_secciones
    where id = p_seccion and planilla_id = p_planilla and activo) then
    raise exception 'Section not found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.productos where id = p_producto and activo) then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;
  select id, activo into v_id, v_activo from public.planilla_items
    where planilla_id = p_planilla and producto_id = p_producto;
  v_existe := v_id is not null;
  if v_existe and v_activo then
    raise exception 'Product already in this planilla' using errcode = '23505';
  end if;
  select coalesce(max(orden), 0) + 1 into v_orden from public.planilla_items
    where planilla_id = p_planilla and seccion_id = p_seccion and activo;
  if v_existe then
    update public.planilla_items set seccion_id = p_seccion, activo = true, orden = v_orden
      where id = v_id;
    return v_id;
  end if;
  insert into public.planilla_items(planilla_id, seccion_id, producto_id, orden)
    values (p_planilla, p_seccion, p_producto, v_orden)
    returning id into v_id;
  return v_id;
end $$;

notify pgrst, 'reload schema';
