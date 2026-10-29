import Link from "next/link";
import { z } from "zod";
import { fechaHoy, pageSession } from "@/lib/data";
import { displayDate, sumarDias } from "@/lib/dates";
import { getWeekSummary } from "@/lib/tasks";

const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export default async function WeekPage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  await pageSession();
  const query = await searchParams;
  const base = z.iso.date().safeParse(query.fecha).success ? query.fecha! : fechaHoy();
  const { weekStart, weekEnd, areas } = await getWeekSummary(base);
  return <div className="space-y-5">
    <Link className="button-secondary" href={`/tareas?fecha=${base}`}>← Todas las tareas</Link>
    <header><p className="eyebrow">Semana del {displayDate(weekStart)} al {displayDate(weekEnd)}</p><h1>Vista semanal</h1>
      <p className="mt-2 text-sm text-zinc-600">Las tareas diarias se cuentan por día; las semanales, una sola vez por semana.</p></header>
    <nav className="flex flex-wrap gap-2"><Link className="button-secondary" href={`/tareas/semana?fecha=${sumarDias(weekStart, -7)}`}>← Semana anterior</Link>
      <Link className="button-secondary" href={`/tareas/semana?fecha=${fechaHoy()}`}>Semana actual</Link>
      <Link className="button-secondary" href={`/tareas/semana?fecha=${sumarDias(weekStart, 7)}`}>Semana siguiente →</Link></nav>
    {areas.map(group => <section className="panel" key={group.area}><h2>{group.nombre}</h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-7">
        {group.dias.map((day, index) => <Link key={day.fecha} href={`/tareas/${group.area === "COCINA" ? "cocina" : "salon"}/${day.fecha}`}
          className={`rounded-lg border p-3 text-sm ${day.fecha === fechaHoy() ? "border-emerald-600" : "border-zinc-200"}`}>
          <p className="text-xs font-semibold">{dias[index]}</p><p className="text-xs text-zinc-500">{displayDate(day.fecha)}</p>
          <p className="mt-2 font-semibold tabular-nums">{day.hechas} / {day.total}</p><p className="text-xs text-zinc-500">diarias</p>
        </Link>)}
      </div>
      {group.semanal.total > 0 && <div className="mt-4 border-t border-zinc-100 pt-3">
        <p className="text-sm font-semibold tabular-nums">Semanales: {group.semanal.hechas} / {group.semanal.total}</p>
        <ul className="mt-2 divide-y divide-zinc-100">{group.semanalDetalle.map(task => <li key={task.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
          <span>{task.nombre}</span><span className={task.fecha ? "text-emerald-800" : "text-zinc-500"}>{task.fecha ? `Hecha el ${displayDate(task.fecha)}` : "Pendiente"}</span></li>)}</ul>
      </div>}
      {group.opcional.total > 0 && <p className="mt-3 text-xs text-zinc-500">Según necesidad: {group.opcional.hechas} / {group.opcional.total} registradas esta semana.</p>}
    </section>)}
    {!areas.length && <p className="panel text-sm text-zinc-600">No hay tareas visibles para esta semana.</p>}
  </div>;
}
