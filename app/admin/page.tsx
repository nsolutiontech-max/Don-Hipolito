import Link from "next/link";
import { redirect } from "next/navigation";
import { pageSession } from "@/lib/data";

export default async function AdminPage() {
  const session = await pageSession();
  if (session.rol !== "DUEÑO") redirect("/hoy");
  return <div className="space-y-5">
    <header><p className="eyebrow">Administración</p><h1>Panel del dueño</h1>
      <p className="mt-2 text-zinc-600">Hola {session.responsable_nombre ?? session.email}. Accesos de control y gestión.</p></header>
    <div className="grid gap-3 sm:grid-cols-2">
      <Link className="panel hover:border-emerald-600" href="/auditorias"><p className="eyebrow">Control</p>
        <h2>Auditorías diarias</h2><p className="mt-2 text-sm text-zinc-600">84 criterios de Cocina y Salón/General, con cierre firmado.</p></Link>
      <Link className="panel hover:border-emerald-600" href="/entrevistas"><p className="eyebrow">Recursos humanos</p>
        <h2>Entrevistas prácticas</h2><p className="mt-2 text-sm text-zinc-600">Evaluación privada por candidato con decisión final.</p></Link>
      <div className="panel" aria-disabled="true"><p className="eyebrow">Planificado</p><h2>Compras y costos</h2>
        <p className="mt-2 text-sm text-zinc-600">Ranking de compras, evolución de precios y recetas. Plan en <code>Docs/hipolito-analitica-compras-costos.md</code>.</p></div>
      <div className="panel" aria-disabled="true"><p className="eyebrow">Planificado</p><h2>Exportar e imprimir</h2>
        <p className="mt-2 text-sm text-zinc-600">Descarga PDF por planilla y fecha después de completar todas las hojas.</p></div>
      <div className="panel" aria-disabled="true"><p className="eyebrow">Pendiente</p><h2>Catálogo y usuarios</h2>
        <p className="mt-2 text-sm text-zinc-600">Productos, unidades, objetivos, proveedores y cuentas se administran todavía por base de datos.</p></div>
    </div>
    <p className="panel text-sm text-zinc-700">No mostrar como disponible lo planificado evita que el equipo opere flujos incompletos.</p>
  </div>;
}
