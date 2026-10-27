import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fechaHoy, pageSession } from "@/lib/data";
import { displayDate } from "@/lib/dates";
import { listAudits } from "@/lib/audits";

export default async function AuditsPage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const session = await pageSession();
  if (session.rol !== "DUEÑO") redirect("/hoy");
  const query = await searchParams;
  const selected = z.iso.date().safeParse(query.fecha).success ? query.fecha! : fechaHoy();
  const audits = await listAudits();
  return <div className="space-y-5">
    <header><p className="eyebrow">Control del dueño</p><h1>Auditorías diarias</h1>
      <p className="mt-2 text-zinc-600">84 criterios de Cocina y Salón/General. Se guardan parcialmente y se cierran con firma.</p></header>
    <form className="panel flex flex-wrap items-end gap-3" method="get">
      <label className="flex-1"><span className="mb-1 block text-sm font-medium">Fecha de auditoría</span>
        <input className="field" type="date" name="fecha" defaultValue={selected} required /></label>
      <button className="button-secondary">Elegir fecha</button>
      <Link className="button-primary" href={`/auditorias/${selected}`}>Abrir o comenzar auditoría</Link>
    </form>
    <section className="panel"><h2>Historial</h2>
      {!audits.length && <p className="mt-3 text-sm text-zinc-600">Todavía no hay auditorías guardadas.</p>}
      <div className="mt-3 divide-y divide-zinc-100">{audits.map(audit => {
        const responses = audit.auditoria_respuestas ?? [];
        const answered = responses.filter(item => item.resultado).length;
        const ok = responses.filter(item => item.resultado === "OK").length;
        return <Link className="flex min-h-16 flex-wrap items-center justify-between gap-2 py-3 hover:bg-zinc-50" href={`/auditorias/${audit.fecha}`} key={audit.id}>
          <div><p className="font-semibold">{displayDate(audit.fecha)}</p>
            <p className="text-xs text-zinc-600">{audit.estado === "CERRADO" ? `Cerrada · ${ok}/84 OK` : `${answered}/84 respondidos`}</p></div>
          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${audit.estado === "CERRADO" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
            {audit.estado === "CERRADO" ? "Cerrada" : "Borrador"}</span>
        </Link>;
      })}</div>
    </section>
  </div>;
}
