# Don Hipólito · Control de Stock — Arquitectura MVP y Plan de Fases

> Reemplazo digital de la planilla en papel (digitalizada en `Docs/Planillas Digitalizables.pdf/.xlsx`): conteo diario por categoría, stock actual y cantidad a pedir, con responsable y fecha por turno.

## Quick path — estado de construcción

1. **Fase 0 ✅:** scaffold Next.js + Tailwind + Supabase + PWA instalable.
2. **Fase 1 ✅:** migraciones SQL (`001` schema, `002` seguridad/usuarios) + seeds (`seed.sql`, `seed2.sql`) con 10 categorías y ~85 productos.
3. **Fase 2 ✅:** módulo Conteo Diario mobile-first (el corazón del MVP).
4. **Fase 3 ✅:** Movimientos (ingreso/merma). **Fase 4 ✅:** Pedidos + WhatsApp.
5. **Extra implementado (fuera del plan original):** Auth con roles DUEÑO/ENCARGADO, panel `/admin`, tabla `usuarios` vinculada a `auth.users`, proveedores, compras y actividades con registros.
6. **Fase 5 (pendiente):** polish + deploy final. Verificación de cada fase = checklist de aceptación al final de este archivo.

## Decisiones cerradas

| Tema | Decisión |
|------|----------|
| Stack | Next.js App Router + Tailwind CSS + Supabase (Postgres) + PWA |
| PWA | Instalable (manifest + iconos). **Sin offline**: hay wifi estable, se evita Service Worker y conflictos de sync |
| Responsables | Lista simple (`responsables` tabla). **Auth implementado** (migración 002): `usuarios` vincula `auth.users` con rol `DUEÑO`/`ENCARGADO` y `responsable_id` opcional |
| Acceso | Login por email/contraseña (Supabase Auth). Dueño (`guille@`) gestiona catálogo y usuarios; encargados operan conteo/movimientos/pedidos. Contraseñas gestionadas por `auth.users` (solo reset, no recuperación) |
| Modelo de datos | Relacional normalizado (no JSON embebido). Detalles de inventario en tabla propia |
| Cálculo pedido | `pedido_sugerido = MAX(0, stock_ideal - stock_real)`, editable manual con marca AUTO/MANUAL |
| Unidades | `KG, UN, LT, PAQ, ATADO, CAJA`. Inputs aceptan decimales y fracciones (`1/2`, `1/4`, `2.5`) |
| Idioma artefactos | Docs en español neutro; identificadores de código y SQL en inglés |

Fuera de alcance MVP: multi-sucursal, modo offline. Costos/precios y proveedores entraron por migración 002 (compras + proveedores); roles/permisos también implementados.

## Arquitectura deseable

```
┌─────────────┐      ┌──────────────────┐      ┌──────────────┐
│  PWA Next.js │ ───▶ │ Supabase Postgres│ ───▶ │ WhatsApp     │
│  (Vercel)    │ ◀─── │ + supabase-js    │      │ wa.me/?text= │
└─────────────┘      └──────────────────┘      └──────────────┘
       │                      │
       │ app/conteo/[fecha]   │ tablas: categorias, productos,
       │ app/movimientos      │ inventarios, inventario_detalles,
       │ app/pedidos          │ movimientos, pedidos, pedido_items
```

### Estructura del proyecto (desde cero)

```
hipolito-stock/
├── app/
│   ├── layout.tsx              # metadata PWA + viewport
│   ├── page.tsx                # redirect a /conteo/hoy
│   ├── conteo/[fecha]/page.tsx # DailyCountPage (Server: carga inicial)
│   ├── movimientos/page.tsx    # MovementsPage
│   └── pedidos/page.tsx        # OrdersPage
├── components/conteo/
│   ├── CountHeader.tsx         # fecha + turno + select responsable
│   ├── CategoryAccordion.tsx   # acordeón por categoría + progreso
│   ├── ProductRow.tsx          # nombre + StockInput + OrderInput
│   ├── StockInput.tsx          # numérico grande, parsea 1/2 y 2,5
│   └── StickySummaryBar.tsx    # faltantes + Guardar + Generar pedido
├── components/movimientos/
│   └── MovementForm.tsx        # producto + tipo + cantidad + motivo
├── components/pedidos/
│   ├── OrderList.tsx           # consolidado por categoría
│   └── WhatsAppExportButton.tsx# genera mensaje y abre wa.me
├── lib/
│   ├── supabase/client.ts      # browser client
│   ├── supabase/server.ts      # server client
│   ├── calculations.ts         # suggestedOrder(ideal, real)
│   └── quantity-parse.ts       # "1/2"→0.5, "2,5"→2.5
├── supabase/
│   ├── migrations/001_schema.sql
│   └── seed.sql                # categorías + productos reales
├── public/
│   ├── manifest.webmanifest
│   └── icons/                  # 192 + 512
└── ARQUITECTURA.md             # este archivo
```

### Convenciones

| Área | Regla |
|------|-------|
| Nombres código | Componentes en inglés (`CategoryAccordion`); **base de datos 100% en español** (`categorias`, `stock_real`, etc.) |
| Estilo | Server Components por defecto; `"use client"` sólo en inputs/acordeón |
| Datos | Server carga categorías+productos+detalle del día; Client hace upsert optimista |
| Validación | Zod en formularios; constraints CHECK en SQL |

## Modelo de datos (Supabase / Postgres)

> Nota: migración 002 reemplazó el acceso anónimo del MVP por RLS por rol: catálogo (lectura autenticada, escritura solo DUEÑO vía función `es_dueno()`), operativa diaria abierta a autenticados, y `usuarios` visible solo para uno mismo o el dueño.

```sql
-- 001_schema.sql (tablas y columnas en español)
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
```
Ver SQL ejecutable con RLS en `supabase/migrations/001_schema.sql` y `002_seguridad_y_nuevas_tablas.sql`; datos en `supabase/seed.sql` y `supabase/seed2.sql`.

### Tablas agregadas por 002

`proveedores`, `compras` (precio unitario + proveedor + movimiento vinculado), `actividades`, `actividad_registros` (planilla D: masas, rellenos, salsas, controles, producción, limpieza, plegado) y `usuarios` (rol DUEÑO/ENCARGADO + `responsable_id`).

### Seed (extraído de tus planillas)

10 categorías con orden: Verdulería, Aceites, Frutos Secos, Especias, Masa, Harinas (`seed.sql`) + Quesos, Fiambres, Congelados, Varios y 27 actividades (`seed2.sql`). ~85 productos activos.

| Categoría | Productos (ejemplo, lista completa en `seed.sql`) |
|-----------|--------------------------------------------------|
| Verdulería (~25) | Tomate Redondo, Tomate Cherry, Cebolla Morada, Cebolla de Verdeo, Ajo, Lechuga, Rúcula, Limón, Albahaca, Laurel, Perejil, Choclo, Zapallo Anco, Zapallo Cabutiá, Zanahoria, Berenjena, Remolacha, Papa, Batata, Puerro, Espinaca, Zucchini, Palta, Morrón, Cebolla Común |
| Aceites (~5) | Aceite Girasol, Aceite Oliva, Aceite Freidora, Grasa, Huevos |
| Frutos Secos (~4) | Maní, Almendra, Nueces, Castañas |
| Especias (~14) | Orégano, Ají Molido, Pimentón, Pimentón Ahumado, Nuez Moscada, Comino, Peperoncino, Pimienta Negra, Pimienta Blanca, Mix Pimientas, Sal Fina, Sal Gruesa, Hongos de Pino, Tapas Empanada |
| Masa (~3) | Bloques, Bollos, Tapas |
| Harinas (~5) | Harina 3C, Harina Integral, Sémola, Harina Trigo, Pan Rallado |

Cada producto del seed lleva `unidad_medida`, `stock_minimo` y `stock_ideal` inicial estimado (se ajusta con uso real).

## UI — Conteo Diario (módulo principal)

Flujo: login → `/conteo/hoy` → contar por categoría → guardar → generar pedido. El responsable sale de la sesión (nunca del cliente); sin `responsable_id` asignado se muestra aviso para que el dueño lo configure.

| Componente | Responsabilidad | Detalle clave |
|------------|-----------------|---------------|
| `LoginForm` / `LogoutButton` | email + contraseña contra Supabase Auth | Redirige a `/conteo/hoy`; layout sin sesión oculta nav |
| `CountHeader` | fecha, turno MEDIODIA/NOCHE, responsable de sesión | Crea `inventarios(fecha, turno)` si no existe |
| `CategoryAccordion` | una categoría abierta, resto colapsadas, badge `12/25` | Progreso = detalles con `actual_stock NOT NULL` |
| `ProductRow` | nombre + unidad + 2 inputs | Fila alta (min 56px), apta dedo en cocina |
| `StockInput` | stock real | `inputMode="decimal"`, acepta `1/2`, `2,5`; guarda al blur |
| `OrderInput` | cantidad a pedir | Pre-llenado con sugerido; al editar marca `is_manual_override=true` |
| `StickySummaryBar` | fija abajo: faltantes + Guardar + Generar pedido | Nunca tapa el último input (padding-bottom) |

Reglas: guardado parcial por fila (upsert), borrador en `localStorage` como respaldo de recarga, validación `>= 0`.

## UI — fases siguientes (resumen)

* **Movimientos:** `MovementForm` (producto + tipo INGRESO/EGRESO + cantidad + motivo). Lista reciente; responsable siempre de sesión.
* **Pedidos:** `OrderList` consolidada por categoría; `WhatsAppExportButton` genera texto `*PEDIDO DD/MM TURNO* — Verdulería: …` y abre `https://wa.me/?text=<encoded>`. Cambio de estado PENDIENTE→ENVIADO→RECIBIDO.
* **Admin (solo DUEÑO):** `/admin` para ABM de productos, proveedores, precios, usuarios y reportes. Link visible en nav con badge ámbar.

## Fases de construcción

> Estado: Fases 0–4 construidas y verificables en código + DB. Fase 5 pendiente. Auth/Admin agregados como extra (migración 002).

### Fase 0 — Setup base ✅
Objetivo: repo limpio que corre y es instalable como PWA.
Entregables: Next.js (TS) + Tailwind + ESLint, clientes Supabase, `manifest.webmanifest` + iconos, layout con nav (Conteo/Movimientos/Pedidos), `.env.example`.
Aceptación: `npm run dev` y `npm run build` en verde; Lighthouse PWA instalable OK.

### Fase 1 — Base de datos + seed ✅
Objetivo: schema y datos reales.
Entregables: `001_schema.sql` + `002_seguridad_y_nuevas_tablas.sql` aplicados; `seed.sql` y `seed2.sql` con 10 categorías, ~87 productos, 27 actividades y 3 responsables.
Aceptación verificada en DB remota (pooler): 87 productos activos, 10 categorías, 4 usuarios, 27 actividades.

### Fase 2 — Conteo Diario ⭐ (corazón del MVP) — código listo, sin uso real aún
Objetivo: reemplazar el papel con el celular.
Entregables: los componentes de conteo + `lib/calculations.ts` + `lib/quantity-parse.ts` + upsert por fila + draft localStorage.
Aceptación pendiente: completar un conteo de 25 items de Verdulería en < 10 min con una mano (aún no hay `inventarios` registrados).

### Fase 3 — Movimientos — código listo, sin uso real aún
Objetivo: registrar ingreso de proveedor y merma sin papel aparte.
Entregables: `MovementForm` + lista reciente + validación qty > 0.
Aceptación pendiente: un INGRESO y un EGRESO registrados (0 movimientos en DB).

### Fase 4 — Pedidos + WhatsApp — código listo, sin uso real aún
Objetivo: del conteo al mensaje al proveedor en un tap.
Entregables: consolidado por categoría, `pedidos` + `pedido_items`, export `wa.me`, cambio de estado.
Aceptación pendiente: primer pedido real enviado (0 pedidos en DB).

### Extra — Auth + Admin (migración 002, fuera del plan original)
Entregables: login (`/login`), `usuarios` con rol DUEÑO/ENCARGADO vinculado a `auth.users`, RLS por rol, panel `/admin` para el dueño, `proveedores`, `compras`, `actividades` + `actividad_registros`.
Usuarios reales: `guille@` (DUEÑO) + `nico@`, `namir@`, `leo@` (ENCARGADO, vinculados a responsables).

### Fase 5 — Polish + deploy
Objetivo: usable en cocina real.
Entregables: iconos finales, theme-color, viewport-fit, deploy Vercel + variables Supabase, README de uso por turno.
Aceptación: instalado en un Android desde Chrome, abre a pantalla completa, carga inicial < 3s en wifi.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Nombres de productos ilegibles en foto | Seed con `activo` y ABM de corrección en `/admin` |
| Teclado móvil lento | Inputs `inputMode` + steppers + guardado al blur |
| Cuenta compartida/dispositivo en cocina | Cerrar sesión al terminar turno; contraseñas solo reset (nunca recuperación) |
| Alcance (scope creep) | Congelado: no se agregan campos fuera del schema de este archivo |

## Checklist global

- [ ] Fase 0: build verde + PWA instalable (verificar con `npm run build` + Lighthouse)
- [x] Fase 1: ≥ 50 productos seed verificados en Supabase (87 activos, verificado por pooler 2026-10-26)
- [ ] Fase 2: conteo completo de un turno real sólo con el celular (0 inventarios aún)
- [ ] Fase 3: ingreso y merma registrados (0 movimientos aún)
- [ ] Fase 4: mensaje WhatsApp enviado al proveedor real (0 pedidos aún)
- [ ] Fase 5: app instalada en el celular de cocina

## Próximo paso — Plan de diseño (UI/UX)

Definir en una sesión dedicada: sistema de diseño (tokens, tipografía, densidad para cocina), flujo de conteo con una mano, estados vacíos/carga/error consistentes, y accesibilidad táctil. Base actual: Tailwind 4, paleta emerald/zinc, inputs h-12 mobile-first.

## Cómo operar la DB (referencia de sesión)

- **SQL directo:** pooler `postgresql://postgres.<ref>:<pass>@aws-0-us-east-1.pooler.supabase.com:6543/postgres` con `NODE_TLS_REJECT_UNAUTHORIZED=0` (ver `scripts/verificar-db.mjs`).
- **Admin REST:** `SERVICE_ROLE_KEY` como `Authorization: Bearer` contra `https://<ref>.supabase.co/rest/v1/` y `/admin/v1` para auth admin.
- **URL directa `db.<ref>.supabase.co`:** bloqueada por DNS en la red actual. CLI completo requiere `SUPABASE_ACCESS_TOKEN` del dashboard.
