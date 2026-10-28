# Don Hipólito · Operaciones diarias

Una planilla por fecha, sin turnos. Los inventarios y las tareas se pueden completar parcialmente y retomar a cualquier hora. Estado actualizado: **28 de octubre de 2026**.

## Estado de implementación

| Área | Estado real |
|------|-------------|
| Stock A / B / C | Implementados: 57 / 60 / 58 artículos del documento |
| Reposición de Bebidas | Implementada: 47 artículos, cantidades independientes Depósito/Heladera y total |
| Ingresos–Egresos | Registro de movimientos con responsable de sesión |
| Tareas Cocina Check | 49 ocurrencias diarias, hora, observaciones y autor |
| Tareas Salón Check | 36 ocurrencias, incluidos los 10 controles de baños |
| Tareas Salón | Consulta de las 20 definiciones de apertura/cierre y frecuencia |
| Pedidos | Persistidos, asociados al inventario, creación transaccional e idempotente; estados PENDIENTE/ENVIADO/RECIBIDO desde el historial; filtros por estado y fecha; exportación por WhatsApp |
| Rol CAMARERO | Implementado en navegación, páginas, acciones y RLS; cuenta creada |
| Auditoría | Implementada: plantilla de 84 ítems (40 Cocina + 44 Salón/General), borrador parcial, puntaje y cierre firmado |
| Entrevista Práctica | Implementada: evaluación privada por candidato con 6 secciones, 40 criterios, resultados por sección y decisión final |
| Administración | Hub del dueño con Auditorías, Entrevistas, ABM de catálogo y ABM de usuarios; gestión de planillas pendiente |
| Cierre de planillas / reapertura | Pendiente; el bloque actual permite guardar y retomar, sin cierre automático |
| Despliegue y aceptación en restaurante | Pendientes; las pruebas automatizadas no sustituyen un día real de operación |

> El archivo `Docs/Planillas Digitalizables.pdf` contiene internamente el mismo XLSX que `Docs/Planillas Digitalizables.xlsx`. Se usó el contenido del libro, no OCR. `Docs/catalogo-conciliado.json` conserva las referencias de celda de los 222 artículos.

## Decisiones vigentes

| Tema | Decisión |
|------|----------|
| Stack | Monolito modular: Next.js 16.3.6, React 19, Tailwind 4, Supabase/PostgreSQL y Zod |
| Componentes | Carga en Server Components; formularios interactivos en Client Components; mutaciones mediante Server Actions |
| Identidad diaria | `inventarios UNIQUE(planilla_id, fecha)`; no existe columna `turno` |
| Calendario | Fecha comercial en `America/Argentina/Buenos_Aires`; no depende del UTC del servidor |
| Catálogo | No destructivo: se preservan IDs, se concilian sinónimos explícitos y se retienen extras no vinculados para revisión |
| Presentaciones | Producto + presentación: una Coca-Cola de 350 cc no se mezcla con una de 1 L |
| Unidades | Las nuevas unidades desconocidas se marcan `POR_DEFINIR`, no se inventan |
| Confirmación de objetivo | Al fijar `stock_ideal`, un trigger marca `objetivo_confirmado = true`. Borrar el valor desactiva la sugerencia aunque el flag siga en `true` |
| Pedido sugerido | Sólo si `objetivo_confirmado = true` y existe `stock_ideal`. Los ideales estimados antiguos se conservan, pero no se usan automáticamente |
| Respaldo local | Borrador por usuario + planilla + fecha; sólo guarda filas modificadas y observaciones. Recuperación explícita; aviso si cambió la versión del servidor |
| PWA | Manifest e iconos existentes. Sin modo offline ni sincronización en segundo plano |
| Diseño | Tema claro, emerald/zinc, controles de 48 px, navegación inferior móvil y lateral en escritorio |
| Idioma | Interfaz y documentación en español; nuevas utilidades de código en inglés; tablas existentes en español |

## Modelo y seguridad

```text
PWA / Next.js
  ├─ página de servidor: sesión + lectura con RLS
  ├─ componente cliente: cantidades, filtros y borrador
  └─ Server Action: autenticación + Zod
       └─ RPC SECURITY INVOKER / escritura con JWT del usuario
            └─ PostgreSQL: RLS + constraints + autoría de sesión
```

### Inventarios

- `planillas_inventario`: Stock A, Stock B, Stock C y Bebidas.
- `planilla_secciones`: agrupación y orden propios de cada planilla.
- `planilla_items`: asociación con producto; la FK compuesta impide vincular una sección de otra planilla.
- `inventarios`: fecha, planilla, observaciones, creador y última actualización; estado de cierre con autoría (`ABIERTO`/`CERRADO`, `cerrado_por`, `cerrado_en`, motivo de reapertura). Triggers en BD rechazan la edición de una planilla cerrada y limitan la reapertura al dueño.
- `inventario_detalles`: PK `(inventario_id, producto_id, ubicacion)`; ubicación `GENERAL`, `DEPOSITO` o `HELADERA`.

La función `guardar_inventario` persiste cabecera y filas modificadas en una transacción. Rechaza productos o ubicaciones ajenos a la planilla. Cero significa stock contado; vacío significa pendiente. Las sugerencias se recalculan con el catálogo del servidor.

Los pedidos se crean mediante `crear_pedido_con_items(inventario_id)`: el navegador no decide sus ítems. La función lee el conteo guardado, bloquea el inventario y crea como máximo un pedido por inventario. Un pedido ya generado conserva sus cantidades: no se regenera silenciosamente al modificar el conteo.

### Tareas

- `actividades`: definiciones por área; los datos legados se conservan.
- `actividad_programaciones`: 85 ocurrencias con código de origen, orden y horario de referencia cuando existe.
- `actividad_registros`: unicidad por `(programacion_id, fecha)`; repetir la actividad en otra ocurrencia no pisa el registro anterior.
- `salon_frecuencias`: las 20 referencias de apertura/cierre de la hoja original, de consulta para CAMARERO.

El horario `24:00` del documento se conserva como referencia textual. No es un bloqueo horario. Apertura y cierre son agrupaciones de tareas, no turnos de inventario.

**Todavía no existe un planificador automático de frecuencias semanales/según necesidad.** La referencia original se muestra sin inventar equivalencias entre filas repetidas. Las planillas Check conservan sus ocurrencias originales.

### Auditoría

- `auditoria_plantillas`: plantilla versionada `AUDITORIA_2026` e inmutable en este bloque.
- `auditoria_items`: 84 criterios exactos del XLSX, con bloque, grupo y orden; 40 de Cocina y 44 de Salón/General.
- `auditorias`: una por fecha; observaciones generales, firma y estado borrador/cerrado.
- `auditoria_partes`: fecha por bloque y auditor derivado de sesión; no permite atribuir la auditoría a otra persona.
- `auditoria_respuestas`: OK / NO OK / pendiente, observaciones, mejoras y necesidades por criterio.

El borrador se guarda en cualquier momento. La operación normal puede completar bloques por separado. Cierre requiere los 84 criterios respondidos y firma; después queda inmutable en el sistema, con puntaje `OK / 84` calculado. **No hay reabertura ni firma gráfica todavía.** Si el cierre fue erróneo, se revisa fuera del sistema y se documenta como corrección manual hasta implementar reabertura controlada.

La plantilla pertenece al dueño. Cambios futuros de criterios deben usar una nueva versión de plantilla, no editar la actual.

### Entrevistas

- `entrevista_plantillas`: plantilla `ENTREVISTA_PRACTICA`, con 6 secciones y 40 criterios extraídos del XLSX.
- `entrevista_secciones`: título, instrucción condicional y resultado de sección.
- `entrevista_criterios`: Sí/No por criterio y observación opcional.
- `entrevistas`: candidato, fecha, puesto aspirado, evaluador derivado de sesión, cinco valoraciones finales (1–5), decisión final, puesto sugerido y observaciones.
- Los triggers validan que cada respuesta pertenezca a la plantilla de esa entrevista.

**No hay registro formal de incorporación, capacitación ni estado de contratación todavía.** La evaluación queda como historial privado del dueño.

### Permisos

| Acceso | DUEÑO | ENCARGADO | CAMARERO |
|--------|:-----:|:---------:|:--------:|
| Stock A/B/C | Sí | Sí | No |
| Bebidas | Sí | Sí | Sí |
| Tareas Cocina | Sí | Sí | No |
| Tareas Salón y referencia de frecuencias | Sí | Sí | Sí |
| Movimientos / Pedidos / Compras / Proveedores | Sí | Sí | No |
| Auditoría y plantilla de 84 criterios | Sí | No | No |
| Catálogo y gestión de usuarios | Sí | No | No |
| Entrevistas | Sí | No | No |

Las funciones `SECURITY DEFINER` sólo responden predicados de permisos y fijan `search_path = ''`. Las RPC de escritura son `SECURITY INVOKER`, con ejecución revocada a `PUBLIC` y `anon`. Una cuenta inactiva no accede al catálogo. Los triggers derivan autor y responsable desde la sesión, incluso si se escribe directamente por REST.

La cuenta `camarero@donhipolito.com` tiene responsable `Camarero`. Su contraseña temporal está únicamente en `.env.local`, clave `CAMARERO_TEMP_PASSWORD`; no se imprime en scripts ni se versiona. Debe cambiarse antes del uso cotidiano. Las cuentas compartidas identifican el rol/dispositivo, no a una persona individual.

## Mapa de código

```text
app/hoy                       resumen del día, filtrado por RLS
app/stock                     planillas y selección de fecha
app/conteo/[planilla]/[fecha]  inventario diario; también acepta /hoy
app/tareas                    áreas y referencia de frecuencias de Salón
app/tareas/[area]/[fecha]      carga diaria y actualización de ocurrencias
app/pedidos                   historial persistido con estados, filtros y exportación WhatsApp
app/movimientos               ingresos y egresos
app/auditorias                auditoría diaria del dueño e historial
app/entrevistas               evaluaciones prácticas privadas del dueño
app/admin                     hub del dueño y estado de pendientes
app/admin/catalogo            ABM de productos: nombre, categoría, unidad, objetivos
app/admin/usuarios            ABM de usuarios: alta, rol, responsable, reseteo de contraseña y activación
app/mas                       perfil, accesos según rol y cierre de sesión
lib/data.ts                   capa de lectura/autenticación sólo servidor
lib/types.ts                  contratos compartidos
lib/permissions.ts            permisos y conversión de rutas
lib/tasks.ts                  consultas de tareas
lib/audits.ts                 plantilla, respuestas e historial de auditoría
lib/interviews.ts              plantilla, criterios e historial de entrevistas
lib/catalog-admin.ts           ABM de catálogo sólo servidor
lib/users-admin.ts             ABM de usuarios sólo servidor
lib/constants.ts               unidades compartidas
scripts/generar-seed3.py       extracción reproducible del XLSX
scripts/generar-seed-auditoria.py extracción reproducible de los 84 criterios
scripts/generar-seed-entrevista.py extracción reproducible de la evaluación práctica
scripts/test-db.mjs            pruebas PostgreSQL/RLS con rollback total
scripts/browser-smoke.mjs      escenarios de navegador y limpieza de fixtures
```

Los componentes de conteo anteriores por turno fueron reemplazados. `/conteo/hoy` redirige a `/stock` para mantener el acceso antiguo.

## Operación de base de datos

El MCP Supabase configurado corresponde a otro proyecto: **no usarlo para Don Hipólito**. Usar el pooler y las variables locales del proyecto correcto.

Migraciones nuevas ya aplicadas en `rceoboibijmwtxmevash`:

1. `003_planillas_diarias_roles.sql` + `seed3_planillas.sql`: inventarios, catálogo y permisos.
2. `004_tareas_diarias.sql` + `seed4_tareas.sql`: ocurrencias y referencia de Salón.
3. `005_autoria_operativa.sql`: responsable de sesión para escrituras operativas directas y helper de dueño endurecido.
4. `006_auditorias.sql` + `seed5_auditoria.sql`: plantilla, borrador/cierre y permisos de auditoría.
5. `007_entrevistas.sql` + `seed6_entrevistas.sql`: plantilla de evaluación práctica y acceso privado del dueño.
6. `008_confirmar_objetivo_producto.sql`: trigger que confirma el objetivo al fijar `stock_ideal`.

`scripts/migrate.mjs` usa una transacción, un bloqueo asesor y checksums en `private.app_migrations`. Omite archivos ya aplicados y rechaza que se cambien sus contenidos. **No volver a ejecutar los seeds legados 1/2**: contienen nombres e ideales estimados anteriores. Para cambios posteriores, agregar nuevas migraciones.

La migración 003 rechaza una instalación que ya tenga inventarios por turno: no elimina ni fusiona registros históricos por su cuenta. El repositorio actual se migró desde cero inventarios.

```powershell
node scripts/migrate.mjs
node scripts/verificar-db.mjs
node scripts/crear-camarero.mjs  # idempotente: no cambia una contraseña existente
```

TLS se verifica por defecto. En esta red se necesitó la excepción explícita `$env:DB_ALLOW_INSECURE_TLS='1'`; sólo desactiva la verificación del cliente PostgreSQL usado por estos scripts. Es una solución temporal: instalar una CA confiable para retirarla. No usar `NODE_TLS_REJECT_UNAUTHORIZED=0` globalmente.

## Verificación y límites

- `npm run build`: compilación y TypeScript correctos.
- `npm run lint`: sin errores.
- `npm test`: 6 pruebas de dominio.
- `npm run test:catalog`: 3 pruebas contra las celdas del XLSX.
- `npm run test:db`: 52 comprobaciones reales de PostgreSQL/RLS; fixtures y escrituras se revierten.
- Navegador Edge con Playwright: CAMARERO, ENCARGADO y DUEÑO; guardado/recarga, D/H con cero, recuperación de borrador, validación, pedido persistido con estados ENVIADO/RECIBIDO, tareas, auditoría con borrador y cierre 83 OK / 1 NO OK, creación/guardado/recarga de entrevista, ABM de catálogo con producto temporal y confirmación de objetivo, ABM de usuarios con alta de contraseña única, reseteo y desactivación, cierre/reapertura de planilla por el dueño, permisos por URL y logout; vistas de 390 y 1280 px.

Los escenarios de navegador crean registros en una fecha futura sin datos previos y un ENCARGADO temporal; los eliminan al terminar. No representan el primer día de uso real. La edición concurrente de la misma fila sigue siendo última escritura válida; no hay colaboración en tiempo real ni resolución automática de conflictos.

## Siguiente bloque

Completar el ABM de planillas del dueño y validar un día completo con el equipo. La exportación PDF queda planificada para cuando todas las hojas estén implementadas. La analítica de compras/costos está registrada en `Docs/hipolito-analitica-compras-costos.md`. Con unidades y objetivos cargados, el pedido sugerido se activa producto por producto. El plan completo de pendientes vive en `odd/tasks/app-produccion.md`.
