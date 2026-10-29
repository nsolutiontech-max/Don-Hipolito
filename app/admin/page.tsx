import Link from "next/link";
import { redirect } from "next/navigation";
import { pageSession } from "@/lib/data";

export default async function AdminPage() {
  const session = await pageSession();
  if (session.rol !== "DUEÑO") redirect("/hoy");
  return <div className="space-y-5">
    <header><p className="eyebrow">Administración</p><h1>Panel de Guille</h1>
      <p className="mt-2 text-zinc-600">Hola {session.responsable_nombre ?? session.email}. Accesos de control y gestión.</p></header>
    <div className="grid gap-3 sm:grid-cols-2">
      <Link className="panel hover:border-emerald-600" href="/auditorias"><p className="eyebrow">Control</p>
        <h2>Auditorías diarias</h2><p className="mt-2 text-sm text-zinc-600">84 criterios de Cocina y Salón/General, con cierre firmado.</p></Link>
      <Link className="panel hover:border-emerald-600" href="/entrevistas"><p className="eyebrow">Recursos humanos</p>
        <h2>Entrevistas prácticas</h2><p className="mt-2 text-sm text-zinc-600">Evaluación privada por candidato con decisión final.</p></Link>
      <Link className="panel hover:border-emerald-600" href="/admin/compras"><p className="eyebrow">Gestión</p>
        <h2>Compras</h2><p className="mt-2 text-sm text-zinc-600">Registro de compras con precio, unidad y proveedor; cada compra genera su ingreso al stock.</p></Link>
      <Link className="panel hover:border-emerald-600" href="/admin/proveedores"><p className="eyebrow">Gestión</p>
        <h2>Proveedores</h2><p className="mt-2 text-sm text-zinc-600">Altas, contacto y estado de los proveedores activos.</p></Link>
      <div className="panel" aria-disabled="true"><p className="eyebrow">Planificado</p><h2>Exportar e imprimir</h2>
        <p className="mt-2 text-sm text-zinc-600">Descarga PDF por planilla y fecha después de completar todas las hojas.</p></div>
      <Link className="panel hover:border-emerald-600" href="/admin/catalogo"><p className="eyebrow">Gestión</p>
        <h2>Catálogo de productos</h2><p className="mt-2 text-sm text-zinc-600">Unidades, mínimos, objetivos y estado de cada artículo.</p></Link>
      <Link className="panel hover:border-emerald-600" href="/admin/usuarios"><p className="eyebrow">Gestión</p>
        <h2>Usuarios</h2><p className="mt-2 text-sm text-zinc-600">Altas, roles, responsables, reseteo de contraseña y estado de cuentas.</p></Link>
      <Link className="panel hover:border-emerald-600" href="/admin/planillas"><p className="eyebrow">Gestión</p>
        <h2>Planillas</h2><p className="mt-2 text-sm text-zinc-600">Secciones, productos y orden de cada planilla; el conteo diario lo refleja al instante.</p></Link>
      <Link className="panel hover:border-emerald-600" href="/admin/tareas"><p className="eyebrow">Gestión</p>
        <h2>Frecuencias de tareas</h2><p className="mt-2 text-sm text-zinc-600">Tareas diarias, semanales o según necesidad; el progreso diario se calcula solo.</p></Link>
    </div>
    <p className="panel text-sm text-zinc-700">No mostrar como disponible lo planificado evita que el equipo opere flujos incompletos.</p>
  </div>;
}
