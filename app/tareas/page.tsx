import Link from "next/link";
import { z } from "zod";
import { fechaHoy, pageSession } from "@/lib/data";
import { canOperate } from "@/lib/permissions";
import { supabaseServer } from "@/lib/supabase/server";

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const session = await pageSession();
  const query = await searchParams;
  const date = z.iso.date().safeParse(query.fecha).success ? query.fecha! : fechaHoy();
  const db = await supabaseServer();
  const { data: frequencies, error } = await db.from("salon_frecuencias").select("*").order("orden");
  if (error) throw new Error("No se pudieron cargar las frecuencias del salón.");
  return <div className="space-y-5"><header><p className="eyebrow">Actividades diarias</p><h1>Tareas del equipo</h1></header>
    <form className="panel flex flex-wrap items-end gap-3"><label className="flex-1"><span className="mb-1 block text-sm font-medium">Fecha</span>
      <input className="field" type="date" name="fecha" defaultValue={date} required /></label><button className="button-secondary">Ver fecha</button></form>
    <div className="grid gap-3 sm:grid-cols-2">
      {canOperate(session.rol) && <Link className="panel" href={`/tareas/cocina/${date}`}><h2>Tareas Cocina Check</h2><p className="mt-2 text-sm text-zinc-600">49 actividades · Completar registro →</p></Link>}
      <Link className="panel" href={`/tareas/salon/${date}`}><h2>Tareas Salón Check</h2><p className="mt-2 text-sm text-zinc-600">36 actividades · Completar registro →</p></Link>
    </div>
    <section className="panel"><h2>Tareas Salón · Apertura y cierre</h2>
      <p className="my-3 text-sm text-zinc-600">Referencia de frecuencias de la planilla original. No representa turnos separados. Las actividades se registran en Tareas Salón Check.</p>
      {["APERTURA", "CIERRE"].map(phase => <details key={phase} className="border-t border-zinc-100"><summary className="min-h-12 cursor-pointer py-3 font-semibold">{phase === "APERTURA" ? "Apertura" : "Cierre"}</summary>
        <ul className="divide-y divide-zinc-100">{frequencies.filter(f => f.fase === phase).map(f => <li key={f.id} className="py-3"><p className="text-sm font-medium">{f.nombre}</p><p className="text-xs text-zinc-500">{f.frecuencia}</p></li>)}</ul>
      </details>)}
    </section>
  </div>;
}
