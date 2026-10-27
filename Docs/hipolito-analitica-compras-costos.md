# Don Hipólito · Analítica de Compras, Costos y Recetas

**Estado:** planificado para una etapa posterior; no implementado.
**Fecha:** 2026-10-27.
**Relación:** anexo de tareas del plan de digitalización. Continúa la numeración existente con T15–T20.

## Pedido original

"ademas mas adelante guille me pidio agregar la funcionalidad de analizar que producto se compra mas y tambien la posibilidad de realizar un analisis de costos es decir que porcentaje de costo va aumentando a travez de las semanas/meses para buscar mejores precios o proveedores o realizar ajustes de aumento sobre el producto en una receta"

## Objetivo

Dar a Guille tres herramientas dentro de Administración:

1. Saber qué productos concentran más compras, medido principalmente por gasto y también por cantidad y frecuencia.
2. Comparar la evolución del costo unitario por semana/mes y entre proveedores.
3. Calcular el costo de una receta y simular el precio de venta necesario para conservar un porcentaje de costo objetivo.

No se recomendará automáticamente un proveedor ni se cambiará un precio de venta sin confirmación del dueño.

## Reglas de negocio

### Compras y unidades

- `importe_compra = cantidad_comprada × precio_unitario_compra`.
- `cantidad_base = cantidad_comprada × factor_a_base`.
- `precio_unitario` representa el precio final pagado por la unidad de compra registrada.
- Moneda inicial: **ARS**. No mezclar monedas ni inventar cotizaciones.
- Los productos con unidad `POR_DEFINIR`, conversión ausente o proveedor desconocido se muestran como **datos incompletos**. Nunca se les asigna costo cero ni una conversión supuesta.
- Se conserva el historial de compras. Cambiar el proveedor o la configuración actual de un producto no reescribe compras anteriores.
- Eliminar la unicidad actual `(producto_id, proveedor_id, fecha, precio_unitario)`: dos compras legítimas pueden tener los mismos valores.
- Semana: lunes a domingo, y mes calendario, ambos en `America/Argentina/Buenos_Aires`.

### Producto más comprado

El ranking principal será por **gasto total en ARS**, porque sumar kilos con unidades no tiene significado. Como vistas secundarias:

- Cantidad comprada en la unidad base del producto, sin comparar unidades incompatibles entre productos.
- Número de compras y última fecha de compra.
- Participación de cada producto sobre el gasto total del período.

Filtros: rango de fechas, categoría, producto y proveedor.

### Evolución de costos

Para cada producto y período con datos completos:

- `costo_unitario_ponderado = SUM(importe_compra) / SUM(cantidad_base)`.
- `variacion_porcentual = (costo_periodo_actual / costo_periodo_anterior - 1) × 100`.
- Si no hay período anterior, cantidad base o historial suficiente, mostrar **Sin comparación**, no 0 %.
- No usar promedio aritmético de precios ni proyectar costos a días sin compras.
- Mostrar cantidad comprada y número de compras junto al porcentaje para evitar conclusiones con muestras mínimas.
- Comparación por proveedor dentro del mismo producto, unidad base y período: costo ponderado, último precio, gasto, cantidad y número de compras.
- El proveedor más barato es un dato, no una recomendación automática: calidad, entrega y condiciones comerciales no están modeladas.

### Recetas y precio de venta

- Receta con rendimiento declarado, por ejemplo 12 empanadas o 1 pizza.
- Ingredientes con producto, cantidad en unidad base y merma opcional expresada como porcentaje adicional requerido.
- Versionar las recetas publicadas para no cambiar silenciosamente el significado de análisis anteriores.
- Método de costo predeterminado: promedio ponderado del período seleccionado. Alternativa explícita: última compra conocida a la fecha de corte.
- `costo_ingrediente = cantidad_base × (1 + merma_pct / 100) × costo_unitario_elegido`.
- `costo_receta = SUM(costo_ingrediente)` y `costo_porcion = costo_receta / rendimiento`.
- Si falta precio, unidad o conversión de un ingrediente, marcar la receta como **costo incompleto** y listar el faltante; no calcularla como si ese ingrediente fuera gratis.
- `food_cost_actual_pct = costo_porcion / precio_venta_actual × 100`.
- `precio_sugerido = costo_porcion / (food_cost_objetivo_pct / 100)`.
- `aumento_sugerido_pct = (precio_sugerido / precio_venta_actual - 1) × 100`.
- Ejemplo de aceptación: costo por porción $300 y objetivo 30 % → precio sugerido $1.000. No usar `costo × 1,30`.
- La simulación no modifica precios. Guardar una decisión de precio y su fecha será una acción separada y confirmada por Guille.

## Cambios de datos previstos

### Compras

Conservar `compras` como líneas de compra, sin crear una cabecera hasta que exista necesidad de remitos/facturas.

- Mantener `producto_id`, `proveedor_id`, `fecha`, `cantidad`, `unidad_medida`, `precio_unitario`, `responsable_id` y `movimiento_id`.
- Agregar moneda, factor de conversión y cantidad base; validar cantidades positivas y precios no negativos.
- Agregar `producto_unidades_compra` para conversiones predeterminadas confirmadas, por ejemplo una caja = 24 unidades. La compra conserva el factor utilizado como evidencia histórica.
- No corregir históricos incompletos automáticamente: revisión manual del dueño.
- Índices por `(producto_id, fecha)`, `(proveedor_id, fecha)` y fecha para los rangos de análisis.

### Recetas

- `recetas`: nombre, rendimiento y estado.
- `receta_versiones`: versión, rendimiento, vigencia y publicación.
- `receta_ingredientes`: versión, producto, cantidad base y merma.
- Los costos se calculan desde compras; no se guarda un costo actual mutable como si fuera historial. Una futura decisión de precio sí debe registrar vigencia y motivo.

### Consultas

Empezar con consultas SQL/vistas sobre las tablas existentes, con agregación en PostgreSQL y filtros de rango. No agregar data warehouse, ETL, caché ni vistas materializadas sin medir primero una necesidad real. Las semanas/meses se calcularán con la zona horaria del restaurante.

## Interfaz de Administración

### Compras

- Filtros de período/categoría/producto/proveedor.
- Tarjetas de gasto total, productos analizados y cobertura de datos.
- Ranking por gasto, cantidad y frecuencia con gráfico simple y tabla accesible.

### Costos

- Selector semanal/mensual y rango de fechas.
- Serie temporal del costo unitario ponderado y tabla de variación porcentual.
- Comparador de proveedores por producto.
- Alertas de aumentos ordenables por porcentaje e impacto en gasto, siempre con tamaño de muestra.

### Recetas

- Lista y detalle de ingredientes, costo por ingrediente, costo total y costo por porción.
- Selector de método de costo y período/fecha de corte.
- Simulador: precio actual, food cost actual, objetivo y precio/aumento sugeridos.
- Datos faltantes destacados antes de cualquier recomendación.

La analítica, las recetas y los precios serán exclusivos de `DUEÑO`. La carga de compras podrá seguir siendo de `DUEÑO`/`ENCARGADO`; `CAMARERO` no tendrá acceso. Toda ruta, acción y consulta debe volver a autorizar, sin depender sólo del menú o de RLS heredado.

## Tareas para ejecutar más adelante

### T15 · Normalizar compras, unidades y conversiones

**Dependencia:** ABM de catálogo/proveedores (T13) y configuración de unidades reales.

- Migración no destructiva para compras y conversiones.
- Eliminar la restricción que impide compras repetidas equivalentes.
- Formulario de compra con unidad, factor confirmado, precio, proveedor, fecha y moneda.
- Bandeja de datos históricos incompletos para revisión manual.
- Aceptación: caja de 24 unidades y compra por unidad producen costos base comparables; los datos incompletos quedan señalados.

### T16 · Ranking de productos comprados

**Dependencia:** T15.

- Consultas agregadas por gasto, cantidad base y frecuencia.
- Página Administración → Compras con filtros, tabla y gráfico accesible.
- Aceptación: los totales coinciden con compras de prueba y no se suman unidades incompatibles.

### T17 · Evolución semanal/mensual y comparación de proveedores

**Dependencia:** T15; puede compartir consultas con T16.

- Costo ponderado por período y comparación con el período anterior.
- Serie temporal, aumentos/disminuciones y comparación de proveedores.
- Aceptación: una compra de 10 kg a $100 y otra de 30 kg a $200 da $175/kg, no $150/kg; sin período anterior muestra Sin comparación.

### T18 · Recetas versionadas y motor de costos

**Dependencia:** T15.

- ABM de recetas, versiones, rendimiento e ingredientes.
- Cálculo por promedio ponderado o última compra a fecha de corte.
- Aceptación: el costo reproduce manualmente una receta de ejemplo y una receta con datos faltantes queda incompleta.

### T19 · Simulador de food cost y aumento de venta

**Dependencia:** T18.

- Food cost actual/objetivo, precio sugerido y aumento porcentual.
- Simulación sin efectos hasta confirmación explícita del dueño.
- Aceptación: costo $300 con objetivo 30 % sugiere $1.000; contra un precio actual de $800 indica 25 % de aumento.

### T20 · Validación integral, seguridad y documentación

**Dependencia:** T15–T19; las pruebas unitarias/de integración acompañan a cada tarea.

- Pruebas de fórmulas, conversiones, compras duplicadas, redondeo, moneda, semanas/meses y cambios de proveedor.
- Fixtures PostgreSQL con rollback y pruebas de permisos para los tres roles.
- Escenarios de navegador del dueño, datos vacíos/incompletos y recetas sin historial.
- Revisión de rendimiento con rangos grandes antes de considerar caché/materialización.
- Actualizar arquitectura, guía de uso y criterios de aceptación con datos reales de Guille.

## Límites de esta etapa

- Sin pronósticos, inteligencia artificial ni recomendación automática de proveedores.
- Sin multimoneda, IVA/fletes desglosados ni actualización automática de precios de venta.
- Sin sumar cantidades de unidades distintas ni completar historial supuesto.
- Sin modificar el esquema ni implementar pantallas durante esta planificación.
