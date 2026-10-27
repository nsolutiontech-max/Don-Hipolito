import Link from "next/link";
import { fechaHoy, getSheets, pageSession } from "@/lib/data";
import { displayDate } from "@/lib/dates";
import { sheetSlug } from "@/lib/permissions";
import { supabaseServer } from "@/lib/supabase/server";

export default async function TodayPage() {
  const session = await pageSession();
  const sheets = await getSheets();
  const db = await supabaseServer();
  const date = fechaHoy();
  const [items, counts] = await Promise.all([
    db.from("planilla_items").select("planilla_id,producto_id"),
    db.from("inventarios").select("planilla_id,inventario_detalles(producto_id,stock_real,ubicacion)").eq("fecha", date),
  ]);
  if (items.error || counts.error) throw new Error("No se pudo cargar el resumen diario.");
  const auditToday = await db.from("auditorias").select("id,estado,auditoria_respuestas(resultado)").eq("fecha", date).maybeSingle();
  if (auditToday.error) throw new Error("No se pudo cargar la auditoría de hoy.");
  const auditResponses = auditToday.data?.auditoria_respuestas ?? [];
  const auditAnswered = auditResponses.filter((item: { resultado: string | null }) => item.resultado).length;
  const auditOk = auditResponses.filter((item: { resultado: string | null }) => item.resultado === "OK").length;
  return <div className="space-y-5">
    <header><p className="eyebrow">{displayDate(date)}</p><h1>La operación de hoy</h1>
      <p className="mt-2 text-zinc-600">Una planilla por día. Guarda y continúa cuando lo necesites.</p></header>
    <section className="grid gap-3 sm:grid-cols-2" aria-label="Inventarios de hoy">
      {sheets.map(sheet => {
        const total = items.data.filter(i => i.planilla_id === sheet.id).length;
        const details = counts.data.find(i => i.planilla_id === sheet.id)?.inventario_detalles ?? [];
        const byProduct = new Map<string, number>();
        for (const d of details) if (d.stock_real !== null) byProduct.set(d.producto_id, (byProduct.get(d.producto_id) ?? 0) + 1);
        const done = [...byProduct.values()].filter(n => n === (sheet.codigo === "BEBIDAS" ? 2 : 1)).length;
        return <Link className="panel block hover:border-emerald-600" key={sheet.id} href={`/conteo/${sheetSlug(sheet.codigo)}/${date}`}>
          <p className="eyebrow">Inventario diario</p><h2>{sheet.nombre}</h2>
          <p className="mt-3 text-sm tabular-nums">{done} / {total} artículos · {done === total && total > 0 ? "Completo" : done ? "En curso" : "Sin iniciar"}</p>
          <progress className="mt-2 w-full accent-emerald-700" value={done} max={total || 1} aria-label={`Progreso de ${sheet.nombre}`} />
        </Link>;
      })}
    </section>
    <Link href="/tareas" className="panel block hover:border-emerald-600"><p className="eyebrow">Actividades</p>
      <h2>{session.rol === "CAMARERO" ? "Tareas del salón" : "Tareas de cocina y salón"}</h2><p className="mt-2 text-sm text-zinc-600">Consultar y completar las actividades diarias →</p></Link>
    {session.rol === "DUEÑO" && <Link href={`/auditorias/${date}`} className="panel block hover:border-emerald-600"><p className="eyebrow">Control del dueño</p>
      <h2>Auditoría diaria</h2><p className="mt-2 text-sm tabular-nums">{auditAnswered} / 84 respondidos
        {auditToday.data?.estado === "CERRADO" ? ` · Cerrada con ${auditOk}/84 OK` : " · Borrador"} →</p></Link>}
  </div>;
}
