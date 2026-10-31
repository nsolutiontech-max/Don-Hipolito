import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DateNavigation } from "@/components/conteo/DateNavigation";
import { displayDate, fechaHoy, getInventoryCatalog, getInventoryHistory, pageSession } from "@/lib/data";
import { estadoInventario, type EstadoHistorial } from "@/lib/inventory-history";
import { canAccessSheet, parseSheetCode, sheetSlug } from "@/lib/permissions";

const ESTADO_CLASES: Record<EstadoHistorial, string> = {
  COMPLETO: "bg-emerald-100 text-emerald-900",
  PARCIAL: "bg-amber-100 text-amber-900",
  CERRADO: "bg-zinc-200 text-zinc-800",
};
const ESTADO_LABEL: Record<EstadoHistorial, string> = {
  COMPLETO: "Completo",
  PARCIAL: "Parcial",
  CERRADO: "Cerrado",
};

export default async function InventoryHistoryPage({ params }: { params: Promise<{ planilla: string }> }) {
  const session = await pageSession();
  const path = await params;
  const code = parseSheetCode(path.planilla);
  if (!code) notFound();
  if (!canAccessSheet(session.rol, code)) redirect("/hoy");
  const catalog = await getInventoryCatalog(code);
  if (!catalog) notFound();
  const ubicacionesRequeridas = catalog.sheet.modo === "STOCK_UBICACIONES" ? 2 : 1;
  const history = await getInventoryHistory(catalog.sheet.id, ubicacionesRequeridas);
  const total = catalog.products.length;
  const today = fechaHoy();
  const basePath = `/conteo/${sheetSlug(code)}`;
  return <div className="space-y-5">
    <header>
      <p className="eyebrow">Historial · {catalog.sheet.nombre}</p>
      <h1>Días anteriores</h1>
      <p className="mt-2 text-sm text-zinc-600">Consulta cualquier fecha sin recordar la URL. Cada día conserva su estado de cierre y cuántos artículos quedaron completos.</p>
    </header>
    <Link className="button-primary" href={`${basePath}/${today}`}>Abrir el inventario de hoy</Link>
    <DateNavigation basePath={basePath} date={today} today={today} mostrarHistorial={false} titulo="Abrir otra fecha" />
    <section className="space-y-3" aria-label="Inventarios guardados">
      <h2>Últimos registros</h2>
      {!history.length && <div className="panel"><p className="mb-3">Todavía no hay inventarios guardados para esta planilla.</p>
        <Link className="button-secondary" href={`${basePath}/${today}`}>Empezar el de hoy</Link></div>}
      {history.map(entry => {
        const estado = estadoInventario(entry.estado, entry.completos, total);
        return <Link key={entry.id} href={`${basePath}/${entry.fecha}`}
          className="panel flex flex-wrap items-center gap-3 hover:border-emerald-600">
          <div className="flex-1">
            <p className="font-semibold">{entry.fecha === today ? "Hoy · " : ""}{displayDate(entry.fecha)}</p>
            <p className="text-sm tabular-nums text-zinc-600">{entry.completos} / {total} artículos completos</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ESTADO_CLASES[estado]}`}>{ESTADO_LABEL[estado]}</span>
          <span aria-hidden className="text-emerald-800">→</span>
        </Link>;
      })}
    </section>
  </div>;
}
