-- Hipólito · Control de Stock — schema inicial (tablas en español)
-- Ejecutar en Supabase: Dashboard → SQL Editor → New query → pegar y Run.

create table categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  orden int not null default 0
);

create table productos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references categorias(id),
  nombre text not null,
  unidad_medida text not null default 'KG'
    check (unidad_medida in ('KG','UN','LT','PAQ','ATADO','CAJA')),
  stock_minimo numeric(10,2) not null default 0,
  stock_ideal numeric(10,2) not null default 0,
  activo boolean not null default true,
  unique (categoria_id, nombre)
);

create table responsables (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true
);

create table inventarios (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  turno text not null default 'NOCHE'
    check (turno in ('MEDIODIA','NOCHE')),
  responsable_id uuid references responsables(id),
  creado_en timestamptz not null default now(),
  unique (fecha, turno)
);

create table inventario_detalles (
  inventario_id uuid not null references inventarios(id) on delete cascade,
  producto_id uuid not null references productos(id),
  stock_real numeric(10,2),
  cantidad_pedida numeric(10,2),
  cantidad_sugerida numeric(10,2),
  es_ajuste_manual boolean not null default false,
  primary key (inventario_id, producto_id)
);

create table movimientos (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id),
  tipo text not null check (tipo in ('INGRESO','EGRESO')),
  cantidad numeric(10,2) not null check (cantidad > 0),
  motivo text not null,
  fecha timestamptz not null default now(),
  responsable_id uuid references responsables(id)
);

create table pedidos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  estado text not null default 'PENDIENTE'
    check (estado in ('PENDIENTE','ENVIADO','RECIBIDO')),
  creado_en timestamptz not null default now()
);

create table pedido_items (
  pedido_id uuid not null references pedidos(id) on delete cascade,
  producto_id uuid not null references productos(id),
  cantidad numeric(10,2) not null check (cantidad > 0),
  primary key (pedido_id, producto_id)
);

create index idx_productos_categoria on productos(categoria_id);
create index idx_detalles_inventario on inventario_detalles(inventario_id);
create index idx_movimientos_producto on movimientos(producto_id);

-- MVP sin Auth: RLS permisivo para la anon key.
-- Al agregar login, reemplazar por políticas por usuario.
alter table categorias enable row level security;
alter table productos enable row level security;
alter table responsables enable row level security;
alter table inventarios enable row level security;
alter table inventario_detalles enable row level security;
alter table movimientos enable row level security;
alter table pedidos enable row level security;
alter table pedido_items enable row level security;

create policy "acceso total anon (MVP)" on categorias for all to anon using (true) with check (true);
create policy "acceso total anon (MVP)" on productos for all to anon using (true) with check (true);
create policy "acceso total anon (MVP)" on responsables for all to anon using (true) with check (true);
create policy "acceso total anon (MVP)" on inventarios for all to anon using (true) with check (true);
create policy "acceso total anon (MVP)" on inventario_detalles for all to anon using (true) with check (true);
create policy "acceso total anon (MVP)" on movimientos for all to anon using (true) with check (true);
create policy "acceso total anon (MVP)" on pedidos for all to anon using (true) with check (true);
create policy "acceso total anon (MVP)" on pedido_items for all to anon using (true) with check (true);
