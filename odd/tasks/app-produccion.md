# Plan: app lista para usar (Don Hipólito)

**Fecha:** 2026-10-28. **Base actual:** inventarios diarios (Stock A/B/C + Bebidas), tareas Cocina/Salón, auditoría 84 ítems, entrevistas, pedidos con WhatsApp, ABM catálogo y usuarios, roles/RLS, deploy en https://don-hipolito.vercel.app.

Objetivo: dejar la app lista para uso real del equipo, en orden de valor operativo.

## Fase A — ABM del dueño (completar)

| Tarea | Alcance | Aceptación |
|---|---|---|
| A1 · ABM usuarios ✔ | `/admin/usuarios`: crear cuenta, rol, responsable, resetear contraseña (mostrar una vez), activar/desactivar con bloqueo de autocuenta | ✔ lint/build verdes + smoke DUEÑO (alta, reseteo, desactivación) |
| A2 · ABM planillas ✔ | `/admin/planillas`: secciones e ítems por planilla (agregar/quitar/reordenar, alta/baja productos) | ✔ 66 checks DB (reordenar persiste, archivar conserva historial) + smoke 3 roles |
| A3 · ABM categorías | crear/editar/ordenar categorías globales | filtros de informes y optgroups actualizados |
| A4 · ABM proveedores y compras ✔ | proveedores (alta/edición/estado) y registro de compras con precio, unidad y proveedor | ✔ 66 checks DB (compra ligada a proveedor y movimiento) + smoke 3 roles |

## Fase B — Ciclo operativo

| Tarea | Alcance | Aceptación |
|---|---|---|
| B1 · Estados de pedidos ✔ | marcar ENVIADO/RECIBIDO desde `/pedidos`, historial con fecha/estado | ✔ lint/build + smoke: marcado y persistencia tras recarga |
| B2 · Cierre/reapertura de planillas ✔ | estado CERRADO bloquea edición; dueño puede reabrir con motivo auditado; protección en BD (triggers 009) + `/hoy` muestra "Cerrado" | ✔ checks DB (rechazos y permisos) + smoke DUEÑO cierra/reabre |
| B3 · Progreso de tareas en `/hoy` ✔ | agregado de tareas Cocina/Salón en el resumen diario | ✔ contador por área con barra accesible; smoke 3 roles verifica 1/N en tareas y la barra en `/hoy` |
| B4 · Programador de frecuencias ✔ | frecuencia por ocurrencia (DIARIA/SEMANAL/SEGUN_NECESIDAD), cálculo por semana ISO, vista `/tareas/semana` y ABM `/admin/tareas` (migración 012) | ✔ 75 checks DB (registro semanal único, RLS, derivación) + smoke 3 roles (vista semanal y ABM del dueño) |
| B5 · Historial de inventarios ✔ | por planilla: días pasados con estado completo/parcial/cerrado y navegación de fechas | ✔ lint/build + smoke: historial por planilla, estado y fecha; navegación sin URL |
| B6 · Historial de movimientos con filtros ✔ | lista completa por fecha/producto/tipo (hoy sólo muestra los últimos 20) | ✔ lint/build + smoke: filtros por rango de fechas, producto, tipo; URL persistente; limpiar filtros |

## Fase C — Refinamiento de control

| Tarea | Alcance | Aceptación |
|---|---|---|
| C1 · Reapertura de auditoría ✔ | reabrir con motivo obligatorio (5-500) para DUEÑO y ENCARGADO; entrega cerrada queda registrada en bitácora `auditoria_entregas` (firma, puntaje, quién/por qué reabrió); inmutabilidad del cierre intacta salvo desbloqueo (migración 014) | ✔ lint/build + 81 checks DB (rechazo de edición disfrazada de reapertura, motivo validado, doble entrega, corrección del ENCARGADO) |
| C2 · Estados de entrevistas ✔ | botón Finalizar evaluación (exige decisión cargada); estado FINALIZADA congela filas y respuestas en BD; reabrir con motivo obligatorio (5-500) deja editar de nuevo; búsqueda del historial por candidato/puesto (migración 015) | ✔ lint/build + 89 checks DB (finalizar sin decisión rechazado, congelado de fila y respuestas, doble cierre rechazado, reapertura con motivo y re-edición) |

Nota (2026-10-31): migración `013_auditorias_encargado.sql` habilita a DUEÑO y ENCARGADO para realizar, guardar y cerrar auditorías. El DUEÑO conserva además el acceso de revisión desde `/admin`.
Nota (2026-10-31): decisión del dueño — la reapertura de auditorías es para DUEÑO y ENCARGADO (no sólo el dueño), con motivo obligatorio y trazabilidad completa; implementada como C1.

## Fase D — Exportación (decisión tomada: PDF con PDFKit)

| Tarea | Alcance | Aceptación |
|---|---|---|
| D1 · Export PDF por planilla/fecha ✔ | `/admin/exportaciones`: A4 vertical stock/tareas/bebidas/entrevistas; A4 horizontal auditoría; encabezados repetidos y paginación | ✔ lint/build + smoke: descarga de PDF generable para stock, tareas, auditoría y entrevista |
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
