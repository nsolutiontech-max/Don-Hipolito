---
Nota: copiar y pegar este bloque en lugar de la sección "BTS-Argentina-FanPage" del CV.
---

• Don Hipólito — Operaciones Diarias (Next.js 16 + Supabase) | Ver código en GitHub
Plataforma Full-Stack para la digitalización operativa de un restaurante, reemplazando 10 planillas en papel con inventarios diarios, tareas con cálculo automático de frecuencias (diaria / semanal / según necesidad), pedidos persistidos, auditorías con cierre firmado y gestión de proveedores/compras.

• Responsabilidades:
o Desarrollé la arquitectura completa (Frontend y Backend) con Next.js 16 (App Router), React 19, TypeScript y Tailwind CSS 4, conectada a una base PostgreSQL gestionada mediante Supabase con políticas de seguridad por fila (RLS) y migraciones controladas por checksum.
o Implementé un sistema de inventario diario con cierre auditado (migración 009): protección a nivel de base de datos mediante triggers que bloquean ediciones sobre registros en estado CERRADO, y reapertura exclusiva del rol DUEÑO con motivo obligatorio de al menos 10 caracteres.
o Creé el módulo de tareas con cálculo automático de vencidas/pendientes (migraciones 010–011 y 012): tareas por área (COCINA / SALON) con registro independiente por fecha, barra de progreso accesible en `/hoy`, y cálculo por semana ISO para tareas semanales sin duplicar registros.
o Integré el ABM de proveedores y compras con registro atómico (`registrar_compra`): cada compra genera su movimiento de ingreso (`INGRESO`) en una sola transacción, con restricciones de rol (ENCARGADO crea, CAMARERO bloqueado) y unicidades parciales que permiten compras repetidas.
o Aseguré la calidad mediante 75 comprobaciones de base de datos con rollback total (`scripts/test-db.mjs`), verificación de construcción (`npm run build`), revisión de código (`npm run lint`) y escenarios de navegador con Playwright en 3 roles reales (`scripts/browser-smoke.mjs`), cubriendo vistas de 390 px y 1280 px.
o Diseñé una interfaz minimalista y responsive enfocada en la eficiencia operativa, reduciendo los clics necesarios para completar registros diarios y permitiendo la navegación sin recordar URLs mediante `/conteo/[planilla]/[fecha]` y `/tareas/[area]/[fecha]`.

• Tecnologías: Next.js 16 (App Router), React 19, Tailwind CSS 4, TypeScript, Supabase (PostgreSQL + RLS + Auth), Zod, Playwright, Vercel (despliegue manual), GitHub (control de versiones con commits atómicos de ~400 líneas), PowerShell, Node.js.
