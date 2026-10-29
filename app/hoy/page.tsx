import Link from "next/link";
import { fechaHoy, getSheets, pageSession } from "@/lib/data";
import { displayDate } from "@/lib/dates";
import { sheetSlug } from "@/lib/permissions";
import { supabaseServer } from "@/lib/supabase/server";
import { ProgressBar } from "@/components/ProgressBar";

export default async function TodayPage() {
  const session = await pageSession();
  const sheets = await getSheets();
  const db = await supabaseServer();
  const date = fechaHoy();
  const [items, counts] = await Promise.all([
    db.from("planilla_items").select("planilla_id,producto_id"),
    db.from("inventarios").select("planilla_id,estado,inventario_detalles(producto_id,stock_real,ubicacion)").eq("fecha", date),
  ]);
  if (items.error || counts.error) throw new Error("No se pudo cargar el resumen diario.");
  const auditToday = await db.from("auditorias").select("id,estado,auditoria_respuestas(resultado)").eq("fecha", date).maybeSingle();
  if (auditToday.error) throw new Error("No se pudo cargar la auditoría de hoy.");
  const auditResponses = auditToday.data?.auditoria_respuestas ?? [];
  const auditAnswered = auditResponses.filter((item: { resultado: string | null }) => item.resultado).length;
  const auditOk = auditResponses.filter((item: { resultado: string | null }) => item.resultado === "OK").length;
  const [taskPrograms, taskRecords] = await Promise.all([
    db.from("actividad_programaciones").select("id,actividades!inner(area)").eq("activo", true),
    db.from("actividad_registros").select("programacion_id").eq("fecha", date),
  ]);
  if (taskPrograms.error || taskRecords.error) throw new Error("No se pudo cargar el progreso de tareas.");
  const recorded = new Set((taskRecords.data as { programacion_id: string }[]).map(record => record.programacion_id));
  const taskAreas = (["COCINA", "SALON"] as const).map(area => {
    const ids = (taskPrograms.data as unknown as { id: string; actividades: { area: string } | null }[])
      .filter(row => row.actividades?.area === area).map(row => row.id);
    return { area, total: ids.length, done: ids.filter(id => recorded.has(id)).length };
  }).filter(group => group.total > 0);
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
        const cerrado = counts.data.find(i => i.planilla_id === sheet.id)?.estado === "CERRADO";
        return <Link className="panel block hover:border-emerald-600" key={sheet.id} href={`/conteo/${sheetSlug(sheet.codigo)}/${date}`}>
          <p className="eyebrow">Inventario diario</p><h2>{sheet.nombre}</h2>
          <p className="mt-3 text-sm tabular-nums">{done} / {total} artículos · {cerrado ? "Cerrado" : done === total && total > 0 ? "Completo" : done ? "En curso" : "Sin iniciar"}</p>
          <ProgressBar value={done} max={total} label={`Progreso de ${sheet.nombre}`} />
        </Link>;
      })}
    </section>
    <section className="panel" aria-label="Progreso de actividades">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div><p className="eyebrow">Actividades</p>
          <h2>{session.rol === "CAMARERO" ? "Tareas del salón" : "Tareas de cocina y salón"}</h2></div>
        <Link className="text-sm font-semibold text-emerald-800 underline" href="/tareas">Ver tareas →</Link>
      </div>
      {taskAreas.map(({ area, total: areaTotal, done: areaDone }) => {
        const nombre = area === "COCINA" ? "Cocina" : "Salón";
        return <div className="mt-3" key={area}>
          <p className="text-sm tabular-nums">{nombre}: {areaDone} / {areaTotal} registradas</p>
          <ProgressBar value={areaDone} max={areaTotal} label={`Progreso de tareas de ${nombre}`} />
        </div>;
      })}
      {!taskAreas.length && <p className="mt-2 text-sm text-zinc-600">No hay actividades programadas para hoy.</p>}
    </section>
    {session.rol === "DUEÑO" && <Link href={`/auditorias/${date}`} className="panel block hover:border-emerald-600"><p className="eyebrow">Control del dueño</p>
      <h2>Auditoría diaria</h2><p className="mt-2 text-sm tabular-nums">{auditAnswered} / 84 respondidos
        {auditToday.data?.estado === "CERRADO" ? ` · Cerrada con ${auditOk}/84 OK` : " · Borrador"} →</p></Link>}
  </div>;
}
