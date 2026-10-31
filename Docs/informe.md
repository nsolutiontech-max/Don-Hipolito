# Informe para el Dueño del Restaurante Don Hipólito

## 1. Introducción
Este informe describe el estado actual del proyecto **Don Hipólito**, una plataforma web (Next.js 16 + Supabase) que digitaliza las 10 planillas del restaurante. El objetivo es permitir la gestión de pedidos, inventarios, tareas diarias y frecuencias de trabajo, con una interfaz que contraste claramente y con barras de progreso verdes.

## 2. Visión General del Sistema
- **Instancia por (planilla, fecha)**: Cada planilla se gestiona de forma independiente, sin turnos ni horarios fijos.
- **Roles y permisos**:
  - **CAMARERO** – acceso restringido a Bebidas, Tareas Salón y cálculo de frecuencias.
  - **ENCARGADO** – acceso a tareas de cocina y salón, gestión de inventario y compras.
  - **DUEÑO** – control total de la administración, auditorías, usuarios y configuraciones de frecuencia.
- **Push a origin permitido**: los commits se envían a Git, pero no se disparan deploys automáticos; el despliegue a Vercel es manual y consume cuota.
- **Credenciales**: almacenadas en `.env.local`, nunca en memoria ni en el repositorio.

## 3. Roles y Responsabilidades

| Rol | Responsabilidades principales | Acceso a funcionalidades |
|-----|------------------------------|--------------------------|
| **CAMARERO** | - Registrar y completar tareas diarias de cocina y salón.<br>- Verificar inventario de bebidas.<br>- Revisar y marcar tareas vencidas/pendientes. | - `/tareas` (solo salón).<br>- `/hoy` (solo salón).<br>- No tiene acceso a inventario general ni a la administración. |
| **ENCARGADO** | - Gestionar inventario (crear, actualizar, cerrar).<br>- Registrar compras y movimientos.<br>- Ejecutar pruebas de integración (smoke). | - `/admin/proveedores`, `/admin/compras`.<br>- `/tareas` (cocina y salón).<br>- Acceso a `inventarios` y `planillas`. |
| **DUEÑO** | - Configurar y aprobar frecuencias de tareas (semanal/según necesidad).<br>- Gestionar usuarios, roles y permisos.<br>- Ejecutar auditorías y cerrar planillas.<br>- Control total de la base de datos y migraciones. | - Todo el sistema: `/admin/*`, `/tareas`, `/hoy`, `/tareas/semana`, `/conteo/*`.<br>- Acceso total a la base de datos y a la configuración del servidor. |

## 4. Seguridad y Control de Acceso
- **RLS (Row Level Security)**: Cada tabla tiene políticas que limitan el acceso según el rol y el área (`puede_ver_area`, `puede_ver_hoja`, `es_dueno`).
- **Política de inserción y actualización**: sólo el usuario que creó el registro (`actualizado_por=auth.uid()`) puede editarlo; el dueño (`DUEÑO`) tiene permiso para modificar cualquier registro.
- **Control de credenciales**:
  - `.env.local` contiene `DB_ALLOW_INSECURE_TLS='1'` y otras variables sensibles.
  - Los scripts de prueba (`test-db.mjs`) usan una sesión temporal y rollback total para no afectar datos reales.
- **Validación de entrada**: todas las operaciones de escritura pasan por funciones validadas (`completeTask`, `actualizarProveedor`, etc.) que verifican formato, longitud y permisos antes de ejecutar la consulta.

## 5. Flujo de Trabajo (ODD Protocol)
1. **Autorizar** – confirmar que la solicitud implica una mutación real.
2. **Explorar** – inspeccionar código y requisitos antes de escribir.
3. **Resolver incertidumbre** – preguntar al usuario una sola vez por decisión productiva.
4. **Clasificar** – determinar si la tarea es **small** (inline) o **large** (requiere delegación).
5. **Crear/Trackear** – generar `odd/tasks/<feature>.md` y su espejo en Engram.
6. **Implementar tarea por tarea** – seguir el logbook, crear commits de trabajo-unit, y cerrar cada tarea con su `Risk` line.
7. **Cerrar** – reportar resultados, fallos y próximos pasos; cerrar cada cambio con su `Risk` line.

## 6. Detalle de cada fase (A–F)

| Fase | Descripción | Artefactos principales |
|------|-------------|------------------------|
| **A1** | ABM de usuarios: crear, editar y eliminar usuarios con rol y acceso restringido. | `a04ae01`, `934e3e3` (commits). |
| **B1** | Estados de pedidos: crear, actualizar y cerrar pedidos con historial y estado (ENVIADO, RECIBIDO, CERRADO). | `40b2652`. |
| **B2** | Cierre/reapertura de planillas: migración 009, UI para cerrar y reabrir (solo dueño). | `66732fd`, migración `009_cierre_planillas.sql`. |
| **A2** | ABM de planillas: gestión de secciones, ítems, archivado suave (`activo`) y edición de detalle. | `f19dd4d`, migraciones 010/011. |
| **A4** | Proveedores y compras: CRUD de proveedores, registro de compras atómico (movimiento INGRESO + compra). | `7da8d60`, migraciones 010/011. |
| **B3** | Progreso de tareas en `/hoy`: barra única, registro por área, cálculo automático de vencidas/pendientes. | `5718a03`. |
| **B4** | **Programador de frecuencias** (trabajo reciente):<br>• Migración 012 añade `frecuencia` y lógica de “una vez por semana”.<br>• `lib/tasks.ts` y `app/tareas/semana/page.tsx` implementan cálculo automático.<br>• `/admin/tareas` permite al dueño asignar frecuencia a cada tarea.<br>• Contadores en `/hoy` y `/tareas` usan la semana ISO para contar tareas vencidas/pendientes. | `f91724f`, migración 012, cambios en `lib/tasks.ts`, `app/hoy/page.tsx`, `components/TaskList.tsx`, `app/admin/tareas/*`. |
| **B5** | **Historial de inventarios** – listado de inventarios por planilla, con estado (ABIERTO, CERRADO) y posibilidad de navegar a cualquier fecha anterior. | – (pendiente). |
| **B6** | **Historial de movimientos** – listado filtrado por fecha, producto o tipo (hoy muestra últimos 20). | – (pendiente). |
| **D1** | Exportar PDF con PDFKit una vez que todas las hojas estén implementadas. | – (pendiente). |
| **F1+F2** | Historias de inventario y movimientos, con filtros avanzados. | – (pendiente). |
| **E1–E6** | Funcionalidades de inventario y gestión de productos. | – (pendiente). |

## 7. Seguridad Detallada
- **RLS**: Cada tabla (`actividades`, `actividad_programaciones`, `actividad_registros`, `inventarios`, `planilla_items`, etc.) tiene políticas que limitan la visibilidad según el rol y el área. Por ejemplo, un CAMARERO solo ve actividades de `SALON` y no puede leer `actividades` de `COCINA`.
- **Política de actualización**: `completar_tarea` verifica que el programa exista, que el usuario tenga permiso y que los datos sean válidos antes de insertar o actualizar.
- **Migraciones**: se ejecutan en orden, con checksum para evitar re-aplicación. La migración 012 (frecuencias) se añadió después de validar que la tabla existía y que los tests la aceptan.
- **Pruebas de seguridad**: `test-db.mjs` incluye pruebas de permisos (CAMARERO, ENCARGADO, DUEÑO) y de operaciones prohibidas (por ejemplo, intentar actualizar frecuencia como ENCARGADO).

## 8. Consideraciones Técnicas Importantes
- **Migraciones**: se ejecutan en orden, con checksum para evitar re-aplicación. La migración 012 se añadió después de validar que la tabla existía y que los tests la aceptan.
- **Base de datos**: todas las consultas usan el mismo `supabaseServer`; los scripts de prueba usan una transacción que se revierte al final.
- **Pruebas de integración**: `test-db.mjs` verifica 75 casos, incluyendo la nueva lógica de frecuencia semanal y la capacidad de un CAMARERO para completar una tarea semanal sin crear registros duplicados.
- **Pruebas de UI**: `browser-smoke.mjs` verifica que la barra de progreso sea verde claro, que la barra se vea en `/hoy` y que los tests de tareas y de auditoría pasen sin errores.

## 9. Próximos pasos (B5–B6–D1–F–E)
1. **B5 – Historial de inventarios**: crear endpoint y UI para consultar inventarios de cualquier planilla y fecha, con estado y detalle por producto.
2. **B6 – Historial de movimientos**: permitir filtros por fecha, producto o tipo (ingreso, salida) y mostrar totales consolidados.
3. **D1** – Generar PDF con PDFKit una vez que todas las hojas (A–F) estén implementadas y verificadas.
4. **F1–F2** – Implementar historial de inventarios y movimientos, con filtros y paginación.
5. **E1–E6** – Completar los módulos de gestión de inventario y productos, asegurando que los upserts mantengan las unicidades parciales.

## 10. Enlaces de acceso
- **Código fuente**: https://github.com/nsolutiontech-max/Don-Hipolito
- **Documentación completa (este archivo)**: `docs/informe.md` en la raíz del proyecto
- **Repositorio de migraciones y scripts**: https://github.com/nsolutiontech-max/Don-Hipolito/tree/main/supabase/migrations

Puedes abrir el informe directamente desde tu editor o desde la raíz del proyecto con:

```
docs/informe.md
```

Este informe está listo para ser revisado y actualizado a medida que avancemos. ¡Avísame cuándo quieras continuar con B5 o con cualquier actualización al documento!
