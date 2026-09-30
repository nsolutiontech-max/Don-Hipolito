-- 002: proveedores, compras, actividades, usuarios + RLS por rol (DUEÑO/ENCARGADO)
-- Requiere 001_schema.sql aplicado.

-- ============ Tablas nuevas ============

create table proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  telefono text,
  activo boolean not null default true
);

create table compras (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id),
  proveedor_id uuid references proveedores(id),
  fecha timestamptz not null default now(),
  cantidad numeric(10,2),
  unidad_medida text not null default 'KG',
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0),
  responsable_id uuid references responsables(id),
  movimiento_id uuid references movimientos(id),
  unique (producto_id, proveedor_id, fecha, precio_unitario)
);

create table actividades (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  grupo text not null default 'General',
  orden int not null default 0,
  activo boolean not null default true
);

create table actividad_registros (
  id uuid primary key default gen_random_uuid(),
  actividad_id uuid not null references actividades(id),
  fecha date not null default current_date,
  hora time not null,
  responsable_id uuid references responsables(id),
  nota text,
  unique (actividad_id, fecha)
);

create table usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  rol text not null default 'ENCARGADO'
    check (rol in ('DUEÑO','ENCARGADO')),
  responsable_id uuid references responsables(id),
  activo boolean not null default true
);

create index idx_compras_producto_fecha on compras(producto_id, fecha desc);
create index idx_compras_proveedor on compras(proveedor_id);
create index idx_actividad_registros_fecha on actividad_registros(fecha desc);

-- ============ Helper dueño (bypasea RLS, evita recursión) ============

create or replace function es_dueno()
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from usuarios
    where id = auth.uid() and rol = 'DUEÑO' and activo
  );
$$;

-- ============ Cierre del acceso anónimo del MVP (001) ============

drop policy if exists "acceso total anon (MVP)" on categorias;
drop policy if exists "acceso total anon (MVP)" on productos;
drop policy if exists "acceso total anon (MVP)" on responsables;
drop policy if exists "acceso total anon (MVP)" on inventarios;
drop policy if exists "acceso total anon (MVP)" on inventario_detalles;
drop policy if exists "acceso total anon (MVP)" on movimientos;
drop policy if exists "acceso total anon (MVP)" on pedidos;
drop policy if exists "acceso total anon (MVP)" on pedido_items;

-- ============ Políticas por rol ============

-- Catálogo: lectura autenticada, escritura solo dueño
create policy "catalogo lectura" on categorias for select to authenticated using (true);
create policy "catalogo escritura dueno" on categorias for insert to authenticated with check (es_dueno());
create policy "catalogo modif dueno" on categorias for update to authenticated using (es_dueno()) with check (es_dueno());
create policy "catalogo borrado dueno" on categorias for delete to authenticated using (es_dueno());

create policy "catalogo lectura" on productos for select to authenticated using (true);
create policy "catalogo escritura dueno" on productos for insert to authenticated with check (es_dueno());
create policy "catalogo modif dueno" on productos for update to authenticated using (es_dueno()) with check (es_dueno());
create policy "catalogo borrado dueno" on productos for delete to authenticated using (es_dueno());

create policy "catalogo lectura" on responsables for select to authenticated using (true);
create policy "catalogo escritura dueno" on responsables for insert to authenticated with check (es_dueno());
create policy "catalogo modif dueno" on responsables for update to authenticated using (es_dueno()) with check (es_dueno());
create policy "catalogo borrado dueno" on responsables for delete to authenticated using (es_dueno());

create policy "catalogo lectura" on proveedores for select to authenticated using (true);
create policy "catalogo escritura dueno" on proveedores for insert to authenticated with check (es_dueno());
create policy "catalogo modif dueno" on proveedores for update to authenticated using (es_dueno()) with check (es_dueno());
create policy "catalogo borrado dueno" on proveedores for delete to authenticated using (es_dueno());

create policy "catalogo lectura" on actividades for select to authenticated using (true);
create policy "catalogo escritura dueno" on actividades for insert to authenticated with check (es_dueno());
create policy "catalogo modif dueno" on actividades for update to authenticated using (es_dueno()) with check (es_dueno());
create policy "catalogo borrado dueno" on actividades for delete to authenticated using (es_dueno());

-- Operativa diaria: acceso total autenticado (cocina + dueño)
create policy "operativa total" on inventarios for all to authenticated using (true) with check (true);
create policy "operativa total" on inventario_detalles for all to authenticated using (true) with check (true);
create policy "operativa total" on movimientos for all to authenticated using (true) with check (true);
create policy "operativa total" on pedidos for all to authenticated using (true) with check (true);
create policy "operativa total" on pedido_items for all to authenticated using (true) with check (true);
create policy "operativa total" on compras for all to authenticated using (true) with check (true);
create policy "operativa total" on actividad_registros for all to authenticated using (true) with check (true);

-- Usuarios: cada uno ve la suya, el dueño gestiona todo
alter table usuarios enable row level security;
create policy "usuario propio o dueno" on usuarios for select to authenticated
  using (auth.uid() = id or es_dueno());
create policy "gestion dueno insert" on usuarios for insert to authenticated with check (es_dueno());
create policy "gestion dueno update" on usuarios for update to authenticated
  using (es_dueno()) with check (es_dueno());
create policy "gestion dueno delete" on usuarios for delete to authenticated using (es_dueno());

alter table proveedores enable row level security;
alter table compras enable row level security;
alter table actividades enable row level security;
alter table actividad_registros enable row level security;
