# Feature: Planillas Digitalizables (Don Hipólito)

Branch: feat/planillas-digitalizables
Estado: primera entrega funcional; no se crearon commits ni PRs.
Verificación: build, lint, pruebas de dominio/catálogo, PostgreSQL/RLS y navegador.

## Specs

S1. Digitalizar las 10 hojas del libro `Docs/Planillas Digitalizables` (Stock A, Stock B, Stock C, Ingresos-Egresos, Tareas Cocina Check, Tareas Salón Check, Auditoría, Reposición de Bebidas, Tareas Salón, Check List Entrevista Práctica), con catálogo exacto del documento: 175 renglones de stock (57/60/58) y 47 de bebidas.

S2. "todas las planillas se llenaran una sola vez al dia y no se completara por turnos separados" — una instancia por `(planilla, fecha)`; eliminar `turno` de UI, borradores, pedidos y WhatsApp.

S3. "se podran rellenar en cualquier hora del dia" — sin bloques horarios ni corte; guardado parcial y retoma en cualquier momento.

S4. "crearemos un usuario nuevo 'camarero' quien solo tendra acceso para rellenar el stock/inventario de: 'Tareas salon. Reposicion de bebidas y Tareas Salon Check'" — rol `CAMARERO` con acceso sólo a esas 3 planillas, aplicado en navegación, rutas/actions y RLS.

S5. "ademas confirmo que D/H significa Depósito/Heladera" — dos cantidades por artículo/día (D/H) con total calculado.

S6. No inventar unidades ni stock ideal: productos nuevos con `unidad_medida = POR_DEFINIR` y `stock_ideal = null` hasta configuración; sugerencia automática deshabilitada hasta que exista ideal.

S7. Reconciliación no destructiva: preservar IDs de productos coincidentes, mapear sinónimos evidentes, dejar extras activos pero no vinculados para revisión del dueño.

S8. Entrevistas = una evaluación por candidato (no una planilla operativa diaria).

S9. Diseño: emerald/zinc, 48px de touch, tema claro, nav inferior Hoy/Stock/Tareas/Más, sidebar en escritorio.

S10. Actualizar `ARQUITECTURA.md` al estado real del nuevo modelo.

## Tasks

T1 [S1,S6,S7] Implementado: migración 003, planillas/secciones/ítems, presentación, ideal nullable y confirmación de objetivo, inventario diario por ubicación, pedidos vinculados y RLS. Cierre/reapertura queda pendiente.

T2 [S1,S7] Implementado: generador determinista, seed3 y `Docs/catalogo-conciliado.json`, con las 222 referencias de celda. Verificado con 3 pruebas de catálogo.

T3 [T1,T2] Aplicado: 003 + seed3 + 004 + seed4 + 005 + 006 + seed5 en la DB real; tracking transaccional con checksums. Conteos 57/60/58/47 y plantilla 84 verificados.

T4 [S2,S3] Implementado: sin turnos; borradores aislados por usuario/planilla/fecha, recuperación explícita y limpieza al salir. Navegador confirma guardar/recargar y recuperar.

T5 [S4] Implementado: `canAccessSheet`, guards, navegación filtrada por RLS, RPC SECURITY INVOKER y autoría por triggers. Cuenta CAMARERO creada; credenciales sólo en `.env.local`. 49 comprobaciones SQL/RLS.

T6 [S9] Implementado: tokens, shell móvil/escritorio, Hoy/Stock/Tareas/Más y progreso de inventarios y auditoría en `/hoy`. Progreso agregado de tareas en Hoy aún pendiente.

T7 [S1,S5] Implementado: Stock A sobre `/conteo/[planilla]/[fecha]`; navegador verifica cantidad decimal, fracción, error, borrador, recarga y pedido persistido.

T8 [S1,S5] Implementado: Stock B/C con catálogo y flujo común; Bebidas D/H verificadas en navegador, incluido stock cero.

T9 [S1] Implementado: movimientos protegidos, pedidos persistidos, RPC transaccional e idempotente, WhatsApp sin turno. Cambios de estado ENVIADO/RECIBIDO desde la UI todavía pendientes.

T10 [S1] Parcial: 49/36 ocurrencias Check, referencia de 20 frecuencias, hora y observaciones; SQL y navegador prueban actualización sin duplicados y aislamiento de Cocina. Falta automatizar calendarios semanales/según necesidad y vista semanal.

T11 [S1] Implementado: plantilla inmutable con 84 criterios (40 Cocina + 44 Salón/General), borrador parcial, OK/NO OK, observaciones/mejora/necesidad, cierre validado con firma e historial. SQL/RLS y navegador del dueño verificados. Reabrir auditoría cerrada y firmas gráficas quedan pendientes.

T12 [S8] Implementado: plantilla con 6 secciones y 40 criterios, evaluación por candidato, resultados por sección, observaciones, 5 valoraciones finales y decisión. Acceso exclusivo DUEÑO en RLS/acciones/rutas; SQL, build y navegador verificados. Historial de contratación/finalización formal queda pendiente.

T13 [S1] Parcial: hub del dueño con acceso a Auditorías y Entrevistas y estado de pendientes. Falta ABM de catálogo/plantillas/usuarios.

T14 [S10] Actualizados: `ARQUITECTURA.md` y README con estado real, permisos, comandos, pruebas, límites y pendientes.

## Log

L1. "continuemos trabajando. analiza el siguiente documento que contiene todas las planillas e inventarios que debemos digitalizar luego planifica bien la arquitectura y el diceño de frontend & 'c:\\Users\\Usuario\\Desktop\\Proyectos\\Hipolito\\Docs\\Planillas Digitalizables.pdf'"

L2. 2026-10-26: confirmado plan completo; planillas una vez al día sin turnos, cualquier hora, mostly EOD; nuevo usuario CAMARERO limitado a Tareas Salón, Reposición de Bebidas y Tareas Salón Check; D/H = Depósito/Heladera.

L3. 2026-10-27: ejecución iniciada. Branch feat/planillas-digitalizables.

L4. 2026-10-27: migraciones 003/004/005 aplicadas y CAMARERO creado. 6 pruebas de dominio, 3 de catálogo y comprobaciones PostgreSQL/RLS en verde. Smoke de Edge para CAMARERO y ENCARGADO con fixtures futuros eliminados al terminar. Build y lint correctos. No se modificó la eliminación preexistente de CLAUDE.md.

L5. 2026-10-27: plan de analítica movido a Docs y registrado como T15–T20. Implementada Auditoría (006/seed5), aplicada en DB y verificada con comprobaciones SQL/RLS y smoke Edge de CAMARERO, ENCARGADO y DUEÑO. La prueba de dueño cierra una auditoría 83 OK / 1 NO OK con firma; fixtures se eliminan.

L6. 2026-10-27: implementada Entrevista Práctica (007/seed6), aplicada en DB. 49 comprobaciones PostgreSQL/RLS en verde; smoke Edge del dueño crea, guarda y recarga una evaluación con respuesta y valoración final. Fixtures se eliminan.

## Límite de esta entrega

No se declara completado el plan entero. Faltan ABM del dueño, programación automática de frecuencias, cierre/reapertura, ciclo completo de pedidos, exportación PDF, analítica T15–T20 y aceptación en cocina. Sin cambios remotos de deployment y sin commit/push.
