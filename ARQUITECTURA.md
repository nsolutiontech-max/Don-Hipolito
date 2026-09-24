# Hipólito · Control de Stock — Arquitectura MVP y Plan de Fases

> Reemplazo digital de la planilla en papel (fotos `imagenes/1.jpeg`, `imagenes/2.jpeg`): conteo diario por categoría, stock actual y cantidad a pedir, con responsable y fecha por turno.

## Quick path — cómo vamos a construirlo

1. **Fase 0:** scaffold Next.js + Tailwind + Supabase + PWA instalable (esta semana).
2. **Fase 1:** migración SQL + seed con las 6 categorías y ~55 productos reales de tu papel.
3. **Fase 2:** módulo Conteo Diario mobile-first (el corazón del MVP).
4. **Fase 3:** Movimientos (ingreso/merma). **Fase 4:** Pedidos + WhatsApp. **Fase 5:** polish + deploy.
5. Verificación de cada fase = checklist de aceptación al final de este archivo.

## Decisiones cerradas

| Tema | Decisión |
|------|----------|
| Stack | Next.js App Router + Tailwind CSS + Supabase (Postgres) + PWA |
| PWA | Instalable (manifest + iconos). **Sin offline**: hay wifi estable, se evita Service Worker y conflictos de sync |
| Responsables | Lista simple (`responsables` tabla), sin Supabase Auth en MVP. Migrable a Auth luego |
| Modelo de datos | Relacional normalizado (no JSON embebido). Detalles de inventario en tabla propia |
| Cálculo pedido | `pedido_sugerido = MAX(0, stock_ideal - stock_real)`, editable manual con marca AUTO/MANUAL |
| Unidades | `KG, UN, LT, PAQ, ATADO, CAJA`. Inputs aceptan decimales y fracciones (`1/2`, `1/4`, `2.5`) |
| Idioma artefactos | Docs en español neutro; identificadores de código y SQL en inglés |

Fuera de alcance MVP: multi-sucursal, proveedores múltiples, costos/precios, roles y permisos, modo offline.

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

> Nota: sin Auth en MVP, RLS queda permisivo para `anon` con política de lectura/escritura abierta. Endurecer al agregar Auth (Fase futura).

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
Ver SQL ejecutable con RLS en `supabase/migrations/001_schema.sql` y datos en `supabase/seed.sql`.

### Seed (extraído de tus planillas)

6 categorías con orden: Verdulería, Aceites, Frutos Secos, Especias, Masa, Harinas.

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

Flujo: abrir `/conteo/hoy` → elegir turno + responsable → contar por categoría → guardar → generar pedido.

| Componente | Responsabilidad | Detalle clave |
|------------|-----------------|---------------|
| `CountHeader` | fecha, turno MEDIODIA/NOCHE, select responsable | Crea `inventories(date, shift)` si no existe |
| `CategoryAccordion` | una categoría abierta, resto colapsadas, badge `12/25` | Progreso = detalles con `actual_stock NOT NULL` |
| `ProductRow` | nombre + unidad + 2 inputs | Fila alta (min 56px), apta dedo en cocina |
| `StockInput` | stock real | `inputMode="decimal"`, acepta `1/2`, `2,5`; guarda al blur |
| `OrderInput` | cantidad a pedir | Pre-llenado con sugerido; al editar marca `is_manual_override=true` |
| `StickySummaryBar` | fija abajo: faltantes + Guardar + Generar pedido | Nunca tapa el último input (padding-bottom) |

Reglas: guardado parcial por fila (upsert), borrador en `localStorage` como respaldo de recarga, validación `>= 0`.

## UI — fases siguientes (resumen)

* **Movimientos:** `MovementForm` (producto con buscador + tipo INGRESO/EGRESO + cantidad + motivo + responsable). Lista reciente de últimos 20.
* **Pedidos:** `OrderList` consolidada por categoría desde el conteo del día (`ordered_qty > 0`); `WhatsAppExportButton` genera texto `*PEDIDO DD/MM TURNO* — Verdulería: …` y abre `https://wa.me/?text=<encoded>`. Cambio de estado PENDIENTE→ENVIADO→RECIBIDO.

## Fases de construcción

### Fase 0 — Setup base
Objetivo: repo limpio que corre y es instalable como PWA.
Entregables: Next.js (TS) + Tailwind + ESLint, clientes Supabase, `manifest.webmanifest` + iconos, layout con nav (Conteo/Movimientos/Pedidos), `.env.example`.
Aceptación: `npm run dev` y `npm run build` en verde; Lighthouse PWA instalable OK.

### Fase 1 — Base de datos + seed
Objetivo: schema y datos reales.
Entregables: `001_schema.sql` aplicado, `seed.sql` con 6 categorías + ~55 productos + 3 responsables ejemplo, script de reseed.
Aceptación: conteo `select count(*) from products` ≥ 50; constraint de fracciones y unique(fecha, turno) verificados.

### Fase 2 — Conteo Diario ⭐ (corazón del MVP)
Objetivo: reemplazar el papel con el celular.
Entregables: los 6 componentes de la tabla anterior + `lib/calculations.ts` + `lib/quantity-parse.ts` + upsert por fila + draft localStorage.
Aceptación: completar un conteo de 25 items de Verdulería en < 10 min con una mano; sugerido = ideal − real; edición manual persiste override.

### Fase 3 — Movimientos
Objetivo: registrar ingreso de proveedor y merma sin papel aparte.
Entregables: `MovementForm` + lista reciente + validación qty > 0.
Aceptación: un INGRESO y un EGRESO quedan listados con fecha y responsable.

### Fase 4 — Pedidos + WhatsApp
Objetivo: del conteo al mensaje al proveedor en un tap.
Entregables: consolidado por categoría, crear `orders` + `order_items`, export `wa.me`, cambio de estado.
Aceptación: mensaje generado contiene todos los `ordered_qty > 0` agrupados por categoría.

### Fase 5 — Polish + deploy
Objetivo: usable en cocina real.
Entregables: iconos finales, theme-color, viewport-fit, deploy Vercel + variables Supabase, README de uso por turno.
Aceptación: instalado en un Android desde Chrome, abre a pantalla completa, carga inicial < 3s en wifi.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Nombres de productos ilegibles en foto | Seed con `is_active` y pantalla de corrección en Fase 2 |
| Teclado móvil lento | Inputs `inputMode` + steppers + guardado al blur |
| Sin Auth, cualquiera edita | Aceptado en MVP; RLS permisivo documentado; Auth en roadmap |
| Alcance (scope creep con precios/proveedores) | Congelado: no se agregan campos fuera del schema de este archivo |

## Checklist global

- [ ] Fase 0: build verde + PWA instalable
- [ ] Fase 1: ≥ 50 productos seed verificados en Supabase
- [ ] Fase 2: conteo completo de un turno real sólo con el celular
- [ ] Fase 3: ingreso y merma registrados
- [ ] Fase 4: mensaje WhatsApp enviado al proveedor real
- [ ] Fase 5: app instalada en el celular de cocina

## Next step

Responder **"arrancá Fase 0"** y construyo el scaffold Next.js + Supabase + PWA en este repo.
