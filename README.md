# Don Hipólito · Operaciones diarias

Inventarios, bebidas, tareas y pedidos del restaurante. Cada planilla corresponde a una fecha y se puede completar parcialmente, sin turnos ni bloqueos horarios.

## Inicio rápido

1. Instalar dependencias: `npm ci` (Node.js 22.15 o posterior y Python 3 para pruebas de catálogo).
2. Configurar `.env.local` con las variables de `.env.example`.
3. Ejecutar `npm run dev` y abrir `http://localhost:3000`.

La base remota ya tiene las migraciones 001–008. No ejecutar los seeds legados sobre esa base. Para el estado de instalación y nuevas migraciones, consultar [ARQUITECTURA.md](ARQUITECTURA.md).

## Uso diario

- **Hoy:** progreso de los inventarios permitidos para la cuenta.
- **Stock:** elegir planilla y fecha; completar stock y pedido, guardar y retomar.
- **Bebidas:** ingresar cantidades de **Depósito** y **Heladera**. Un cero es un dato válido; un campo vacío sigue pendiente.
- **Tareas:** elegir Cocina o Salón; registrar hora y observaciones. Actualizar una ocurrencia modifica el mismo registro diario.
- **Pedidos:** generar desde un inventario guardado y compartir por WhatsApp. Abrir WhatsApp no prueba que el mensaje haya sido enviado.
- **Auditorías (dueño):** elegir fecha, responder los 84 criterios en bloques de Cocina y Salón/General, guardar el borrador y cerrar con firma. Después del cierre no se puede editar.
- **Entrevistas (dueño):** crear una evaluación por candidato, responder Sí/No por criterio, registrar resultados por sección y decisión final.
- **Catálogo (dueño):** definir unidad, stock mínimo/ideal y estado por artículo; fijar el ideal confirma el objetivo y activa la sugerencia de pedido para ese producto.
- **Más:** perfil y cierre de sesión. Salir elimina los borradores locales de ese dispositivo.

CAMARERO sólo accede a Bebidas, Tareas Salón Check y la referencia Tareas Salón. El usuario creado es `camarero@donhipolito.com`; la contraseña temporal está en la variable local ignorada `CAMARERO_TEMP_PASSWORD`. No compartir el archivo `.env.local`.

Los artículos nuevos muestran unidad pendiente y pedido manual hasta que el dueño configure datos reales. No hay soporte offline: un borrador local es un respaldo, no un guardado confirmado.

## Pruebas

```powershell
npm test
npm run test:catalog
npm run lint
npm run build
npm run test:db
```

Las pruebas de base usan `POOLER_URL` de `.env.local`, verifican el proyecto y hacen rollback de todos sus cambios. TLS se verifica por defecto; la excepción temporal de esta red se documenta en la arquitectura.

Para la prueba de navegador, tener `playwright-cli` instalado, abrir una sesión `hipolito` con Edge y ejecutar un servidor de producción:

```powershell
node node_modules/next/dist/bin/next start -p 3011
# En otra terminal:
playwright-cli -s=hipolito open --browser=msedge
node scripts/browser-smoke.mjs
```

En otro sistema, configurar `PLAYWRIGHT_CLI_JS` con la ruta del ejecutable JavaScript del CLI. El script usa cuentas temporales y un producto temporal de catálogo, y elimina sus registros al terminar. El ABM de usuarios/planillas del dueño todavía está pendiente.
