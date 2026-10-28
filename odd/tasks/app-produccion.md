# Plan: app lista para usar (Don Hipólito)

**Fecha:** 2026-10-28. **Base actual:** inventarios diarios (Stock A/B/C + Bebidas), tareas Cocina/Salón, auditoría 84 ítems, entrevistas, pedidos con WhatsApp, ABM catálogo y usuarios, roles/RLS, deploy en https://don-hipolito.vercel.app.

Objetivo: dejar la app lista para uso real del equipo, en orden de valor operativo.

## Fase A — ABM del dueño (completar)

| Tarea | Alcance | Aceptación |
|---|---|---|
| A1 · ABM usuarios ✔ | `/admin/usuarios`: crear cuenta, rol, responsable, resetear contraseña (mostrar una vez), activar/desactivar con bloqueo de autocuenta | ✔ lint/build verdes + smoke DUEÑO (alta, reseteo, desactivación) |
| A2 · ABM planillas | `/admin/planillas`: secciones e ítems por planilla (agregar/quitar/reordenar, alta/baja productos) | reordenar persiste y el conteo diario refleja cambios |
| A3 · ABM categorías | crear/editar/ordenar categorías globales | filtros de informes y optgroups actualizados |
| A4 · ABM proveedores y compras | proveedores (alta/edición/estado) y registro de compras con precio, unidad y proveedor | compra queda ligada a proveedor y movimiento |

## Fase B — Ciclo operativo

| Tarea | Alcance | Aceptación |
|---|---|---|
| B1 · Estados de pedidos ✔ | marcar ENVIADO/RECIBIDO desde `/pedidos`, historial con fecha/estado | ✔ lint/build + smoke: marcado y persistencia tras recarga |
| B2 · Cierre/reapertura de planillas ✔ | estado CERRADO bloquea edición; dueño puede reabrir con motivo auditado; protección en BD (triggers 009) + `/hoy` muestra "Cerrado" | ✔ 57 checks DB (rechazos y permisos) + smoke DUEÑO cierra/reabre |
| B3 · Progreso de tareas en `/hoy` | agregado de tareas Cocina/Salón en el resumen diario | contador fiel a registros del día |
| B4 · Programador de frecuencias | semanal/según necesidad automático + vista semanal (referencia ya existe en `salon_frecuencias`) | tareas vencidas/pendientes se calculan solas |
| B5 · Historial de inventarios | por planilla: días pasados con estado completo/parcial/cerrado y navegación de fechas | se consulta cualquier día anterior sin conocer la URL |
| B6 · Historial de movimientos con filtros | lista completa por fecha/producto/tipo (hoy sólo muestra los últimos 20) | filtros devuelven los mismos totales que la DB |

## Fase C — Refinamiento de control

| Tarea | Alcance | Aceptación |
|---|---|---|
| C1 · Reapertura de auditoría | sólo DUEÑO, con motivo registrado e inmutabilidad documentada | auditoría cerrada puede reabrirse con trazabilidad |
| C2 · Estados de entrevistas | finalizar evaluación + búsqueda en historial | estado FINALIZADA distingue de borrador |

## Fase D — Exportación (decisión tomada: PDF con PDFKit)

| Tarea | Alcance | Aceptación |
|---|---|---|
| D1 · Export PDF por planilla/fecha | `/admin/exportaciones`: A4 vertical stock/tareas/bebidas/entrevistas; A4 horizontal auditoría; encabezados repetidos y paginación | PDF descargable con acentos y D/H |
| D2 · XLSX analítica (opcional) | exportar compras/costos para análisis externo | opcional, después de D1 |

## Fase E — Analítica compras/costos (plan detallado en `Docs/hipolito-analitica-compras-costos.md`)

| Tarea | Referencia | Nota |
|---|---|---|
| E1 | T15 compras/unidades/conversiones | previo a rankings y costos |
| E2 | T16 ranking productos más comprados | gasto, cantidad base, frecuencia |
| E3 | T17 evolución semanal/mensual + proveedores | costo ponderado, no promedio simple |
| E4 | T18 recetas versionadas + motor de costos | merma y rendimiento |
| E5 | T19 simulador food cost / precio venta | costo $300 → objetivo 30% = $1.000 |
| E6 | T20 validación integral + documentación | pruebas con rollback |

## Fase F — Puesta en producción real

| Tarea | Alcance | Aceptación |
|---|---|---|
| F1 · Datos reales | cargar unidades/objetivos de los 222 artículos vía `/admin/catalogo` (guía de carga por categoría) | sugeridos habilitados por producto |
| F2 · Día real de aceptación | primer turno completo con usuarios reales; lista de defectos; instalar PWA desde Chrome Android y verificar carga inicial < 3 s en wifi | PWA instalable y Fases B–C verificadas con uso |
| F3 · Hardening | contraseñas más robustas (opcionales), backup/punto de restauración DB, revisión de claves service | respaldo probado una vez |
| F4 · Deploy final | nuevo deploy tras F1–F2; dominio propio opcional | URL de producción estable |

## Deuda técnica menor

- `.env.local` ahora concentra credenciales por usuario (ignorado por git). No commitear ni copiar a memoria.
- `CAMARERO_TEMP_PASSWORD` ya apunta a la clave definitiva; el nombre quedó como clave legado usada por scripts.
- Smoke de navegador: extender con A1 una vez verificado build/lint.

## Orden sugerido

1. Terminar/verificar A1 → 2. B1+B2 (cierran el ciclo diario) → 3. A2+A4 (catálogo/proveedores reales) → 4. B3+B4+B5+B6 → 5. D1 → 6. F1+F2 → 7. E1–E6.
