-- Daily inventory foundation. Run once through scripts/migrate.mjs.
-- Refuse to guess how historical shift-based records should be merged.
do $$ begin
  if exists (select 1 from public.inventarios) then
    raise exception 'Existing inventories require an explicit historical migration';
  end if;
end $$;

alter table public.usuarios drop constraint usuarios_rol_check;
alter table public.usuarios add constraint usuarios_rol_check
  check (rol in ('DUEÑO','ENCARGADO','CAMARERO'));

create table public.planillas_inventario (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo in ('STOCK_A','STOCK_B','STOCK_C','BEBIDAS')),
  nombre text not null,
  modo text not null check (modo in ('STOCK_PEDIDO','STOCK_UBICACIONES')),
  orden int not null,
  activo boolean not null default true
);
create table public.planilla_secciones (
  id uuid primary key default gen_random_uuid(),
  planilla_id uuid not null references public.planillas_inventario(id),
  nombre text not null,
  orden int not null,
  unique (planilla_id, nombre),
  unique (id, planilla_id)
);
create table public.planilla_items (
  id uuid primary key default gen_random_uuid(),
  planilla_id uuid not null references public.planillas_inventario(id),
  seccion_id uuid not null,
  producto_id uuid not null references public.productos(id),
  orden int not null,
  foreign key (seccion_id, planilla_id) references public.planilla_secciones(id, planilla_id),
  unique (planilla_id, producto_id),
  unique (planilla_id, orden)
);
create index on public.planilla_items(producto_id);

alter table public.productos add column presentacion text not null default '';
alter table public.productos drop constraint productos_categoria_id_nombre_key;
alter table public.productos add unique (categoria_id, nombre, presentacion);
alter table public.productos drop constraint productos_unidad_medida_check;
alter table public.productos add check (unidad_medida in ('KG','UN','LT','PAQ','ATADO','CAJA','POR_DEFINIR'));
alter table public.productos alter column stock_ideal drop not null;
alter table public.productos alter column stock_ideal drop default;
alter table public.productos add column objetivo_confirmado boolean not null default false;

alter table public.inventarios drop constraint inventarios_fecha_turno_key;
alter table public.inventarios drop column turno;
alter table public.inventarios add column planilla_id uuid not null references public.planillas_inventario(id);
alter table public.inventarios add column observaciones text not null default '';
alter table public.inventarios add column creado_por uuid references public.usuarios(id);
alter table public.inventarios add column actualizado_en timestamptz not null default now();
alter table public.inventarios add unique (planilla_id, fecha);
alter table public.inventario_detalles add column ubicacion text not null default 'GENERAL'
  check (ubicacion in ('GENERAL','DEPOSITO','HELADERA'));
alter table public.inventario_detalles add column actualizado_por uuid references public.usuarios(id);
alter table public.inventario_detalles add column actualizado_en timestamptz not null default now();
alter table public.inventario_detalles drop constraint inventario_detalles_pkey;
alter table public.inventario_detalles add primary key (inventario_id, producto_id, ubicacion);
alter table public.inventario_detalles add check (stock_real >= 0);
alter table public.inventario_detalles add check (cantidad_pedida >= 0);
alter table public.inventario_detalles add check (cantidad_sugerida >= 0);

alter table public.pedidos add column inventario_id uuid unique references public.inventarios(id);
alter table public.pedidos add column responsable_id uuid references public.responsables(id);
alter table public.pedidos add column creado_por uuid references public.usuarios(id);

-- Definers only expose permission predicates, never mutation entry points.
create function public.rol_actual() returns text
language sql stable security definer set search_path = '' as $$
  select rol from public.usuarios where id = auth.uid() and activo
$$;
create function public.es_dueno_o_encargado() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.rol_actual() in ('DUEÑO','ENCARGADO'), false)
$$;
create function public.puede_ver_planilla(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.planillas_inventario p where p.id = p_id and p.activo
    and (public.es_dueno_o_encargado() or (public.rol_actual() = 'CAMARERO' and p.codigo = 'BEBIDAS')))
$$;
create function public.puede_editar_detalle(p_inventario uuid, p_producto uuid, p_ubicacion text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.inventarios i
    join public.planillas_inventario p on p.id = i.planilla_id
    join public.planilla_items item on item.planilla_id = p.id and item.producto_id = p_producto
    where i.id = p_inventario and public.puede_ver_planilla(p.id)
      and ((p.modo = 'STOCK_PEDIDO' and p_ubicacion = 'GENERAL')
        or (p.modo = 'STOCK_UBICACIONES' and p_ubicacion in ('DEPOSITO','HELADERA')))
  )
$$;

-- Replace permissive legacy policies, including catalogue and activities leaks.
drop policy "catalogo lectura" on public.productos;
drop policy "catalogo lectura" on public.categorias;
drop policy "catalogo lectura" on public.proveedores;
drop policy "catalogo lectura" on public.responsables;
drop policy "catalogo lectura" on public.actividades;
drop policy "operativa total" on public.actividad_registros;
create policy "lectura operativa" on public.actividades for select to authenticated
  using (public.es_dueno_o_encargado());
create policy "registros operativa" on public.actividad_registros for all to authenticated
  using (public.es_dueno_o_encargado()) with check (public.es_dueno_o_encargado());
create policy "proveedores lectura" on public.proveedores for select to authenticated
  using (public.es_dueno_o_encargado());
create policy "responsables lectura" on public.responsables for select to authenticated
  using (public.es_dueno_o_encargado() or id in (select responsable_id from public.usuarios where id = auth.uid()));

alter table public.planillas_inventario enable row level security;
alter table public.planilla_secciones enable row level security;
alter table public.planilla_items enable row level security;
create policy "planillas lectura" on public.planillas_inventario for select to authenticated
  using (public.puede_ver_planilla(id));
create policy "secciones lectura" on public.planilla_secciones for select to authenticated
  using (public.puede_ver_planilla(planilla_id));
create policy "items lectura" on public.planilla_items for select to authenticated
  using (public.puede_ver_planilla(planilla_id));
create policy "productos lectura" on public.productos for select to authenticated
  using (public.es_dueno_o_encargado() or (public.rol_actual() = 'CAMARERO' and exists (
    select 1 from public.planilla_items item where item.producto_id = productos.id
      and public.puede_ver_planilla(item.planilla_id))));
create policy "categorias lectura" on public.categorias for select to authenticated
  using (public.es_dueno_o_encargado() or exists (
    select 1 from public.productos p where p.categoria_id = categorias.id));
create policy "planillas dueno" on public.planillas_inventario for all to authenticated
  using (public.es_dueno()) with check (public.es_dueno());
create policy "secciones dueno" on public.planilla_secciones for all to authenticated
  using (public.es_dueno()) with check (public.es_dueno());
create policy "items dueno" on public.planilla_items for all to authenticated
  using (public.es_dueno()) with check (public.es_dueno());

drop policy "operativa total" on public.inventarios;
drop policy "operativa total" on public.inventario_detalles;
create policy "inventarios lectura" on public.inventarios for select to authenticated
  using (public.puede_ver_planilla(planilla_id));
create policy "inventarios crear" on public.inventarios for insert to authenticated
  with check (public.puede_ver_planilla(planilla_id) and creado_por = auth.uid());
create policy "inventarios actualizar" on public.inventarios for update to authenticated
  using (public.puede_ver_planilla(planilla_id)) with check (public.puede_ver_planilla(planilla_id));
create policy "detalles lectura" on public.inventario_detalles for select to authenticated
  using (public.puede_editar_detalle(inventario_id, producto_id, ubicacion));
create policy "detalles crear" on public.inventario_detalles for insert to authenticated
  with check (public.puede_editar_detalle(inventario_id, producto_id, ubicacion) and actualizado_por = auth.uid());
create policy "detalles actualizar" on public.inventario_detalles for update to authenticated
  using (public.puede_editar_detalle(inventario_id, producto_id, ubicacion))
  with check (public.puede_editar_detalle(inventario_id, producto_id, ubicacion) and actualizado_por = auth.uid());

-- Audit fields cannot be spoofed through direct PostgREST writes.
create function public.autoria_inventario() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' and (new.planilla_id <> old.planilla_id or new.fecha <> old.fecha) then
    raise exception 'Inventory identity is immutable';
  end if;
  if TG_OP = 'UPDATE' then new.creado_por := old.creado_por;
  else new.creado_por := auth.uid(); end if;
  select responsable_id into new.responsable_id from public.usuarios where id=auth.uid() and activo;
  new.actualizado_en := now();
  return new;
end $$;
create trigger autoria_inventario before insert or update on public.inventarios
  for each row execute function public.autoria_inventario();
create function public.autoria_detalle() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.actualizado_por := auth.uid();
  new.actualizado_en := now();
  return new;
end $$;
create trigger autoria_detalle before insert or update on public.inventario_detalles
  for each row execute function public.autoria_detalle();

do $$ declare t text; begin
  foreach t in array array['movimientos','pedidos','pedido_items','compras'] loop
    execute format('drop policy "operativa total" on public.%I', t);
    execute format('create policy "operativa restringida" on public.%I for all to authenticated using (public.es_dueno_o_encargado()) with check (public.es_dueno_o_encargado())', t);
  end loop;
end $$;

-- One transaction for header + changed rows. Suggestions are derived from trusted catalogue values.
create function public.guardar_inventario(p_planilla_id uuid, p_fecha date, p_detalles jsonb, p_observaciones text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_responsable uuid; begin
  if not public.puede_ver_planilla(p_planilla_id) or auth.uid() is null then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  if p_detalles is null or p_observaciones is null or jsonb_typeof(p_detalles) <> 'array'
    or jsonb_array_length(p_detalles) > 500 or length(p_observaciones) > 4000 then
    raise exception 'Invalid inventory payload';
  end if;
  select responsable_id into v_responsable from public.usuarios where id = auth.uid() and activo;
  insert into public.inventarios(planilla_id, fecha, responsable_id, creado_por, observaciones)
    values (p_planilla_id, p_fecha, v_responsable, auth.uid(), p_observaciones)
    on conflict (planilla_id, fecha) do update set actualizado_en = now(), observaciones = excluded.observaciones
    returning id into v_id;
  if exists (select 1 from jsonb_to_recordset(p_detalles) as d(producto_id uuid, ubicacion text)
    where not public.puede_editar_detalle(v_id, d.producto_id, d.ubicacion)) then
    raise exception 'Product or location outside this inventory' using errcode = '42501';
  end if;
  insert into public.inventario_detalles(inventario_id, producto_id, ubicacion, stock_real,
    cantidad_pedida, cantidad_sugerida, es_ajuste_manual, actualizado_por, actualizado_en)
  select v_id, d.producto_id, d.ubicacion, d.stock_real,
    case when d.ubicacion <> 'GENERAL' then null
      when d.es_ajuste_manual then d.cantidad_pedida
      when p.objetivo_confirmado and p.stock_ideal is not null and d.stock_real is not null
        then greatest(0, p.stock_ideal - d.stock_real) end,
    case when d.ubicacion = 'GENERAL' and p.objetivo_confirmado and p.stock_ideal is not null and d.stock_real is not null
      then greatest(0, p.stock_ideal - d.stock_real) end,
    coalesce(d.es_ajuste_manual, false), auth.uid(), now()
  from jsonb_to_recordset(p_detalles) as d(producto_id uuid, ubicacion text, stock_real numeric,
    cantidad_pedida numeric, es_ajuste_manual boolean)
  join public.productos p on p.id = d.producto_id
  on conflict (inventario_id, producto_id, ubicacion) do update set
    stock_real = excluded.stock_real, cantidad_pedida = excluded.cantidad_pedida,
    cantidad_sugerida = excluded.cantidad_sugerida, es_ajuste_manual = excluded.es_ajuste_manual,
    actualizado_por = auth.uid(), actualizado_en = now();
  return v_id;
end $$;

-- The client supplies only the inventory ID; line quantities come from persisted counts.
create function public.crear_pedido_con_items(p_inventario_id uuid)
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
    select v_id, producto_id, cantidad_pedida from public.inventario_detalles
    where inventario_id = p_inventario_id and ubicacion = 'GENERAL' and stock_real is not null and cantidad_pedida > 0;
  if not found then raise exception 'No counted products with order quantities'; end if;
  return v_id;
end $$;

revoke all on function public.rol_actual(), public.es_dueno_o_encargado(), public.puede_ver_planilla(uuid),
  public.puede_editar_detalle(uuid,uuid,text), public.guardar_inventario(uuid,date,jsonb,text),
  public.crear_pedido_con_items(uuid) from public, anon;
grant execute on function public.rol_actual(), public.es_dueno_o_encargado(), public.puede_ver_planilla(uuid),
  public.puede_editar_detalle(uuid,uuid,text), public.guardar_inventario(uuid,date,jsonb,text),
  public.crear_pedido_con_items(uuid) to authenticated;
grant select, insert, update, delete on public.planillas_inventario, public.planilla_secciones, public.planilla_items to authenticated;
grant all on public.planillas_inventario, public.planilla_secciones, public.planilla_items to service_role;
notify pgrst, 'reload schema';
