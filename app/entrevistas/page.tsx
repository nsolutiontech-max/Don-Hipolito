import Link from "next/link";
import { redirect } from "next/navigation";
import { pageSession } from "@/lib/data";
import { listInterviews } from "@/lib/interviews";
import { NewInterviewForm } from "@/components/interviews/NewInterviewForm";

const DECISIONS = { SI: "Sí", SI_CAPACITACION: "Sí con capacitación", DUDAS: "Dudas", NO: "No" } as const;

export default async function InterviewsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await pageSession();
  if (session.rol !== "DUEÑO") redirect("/hoy");
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const interviews = await listInterviews(20, query || undefined);
  return <div className="space-y-5">
    <header><p className="eyebrow">Recursos humanos</p><h1>Entrevistas prácticas</h1>
      <p className="mt-2 text-zinc-600">Evaluación privada por candidato. Visible sólo para el admin.</p></header>
    <NewInterviewForm />
    <form className="panel flex flex-wrap items-end gap-3" method="get">
      <label className="flex-1 min-w-48"><span className="mb-1 block text-sm font-medium">Buscar por candidato o puesto</span>
        <input className="field" name="q" defaultValue={query} placeholder="Ej.: Mariana, Cocina…" maxLength={100} /></label>
      <button className="button-secondary">Buscar</button>
      {query && <Link className="text-sm text-zinc-600 underline" href="/entrevistas">Limpiar</Link>}
    </form>
    <section className="panel"><h2>Historial{query && <span className="text-sm font-normal text-zinc-600"> · resultados para “{query}”</span>}</h2>
      {!interviews.length && <p className="mt-3 text-sm text-zinc-600">{query ? "Ninguna entrevista coincide con la búsqueda." : "Todavía no hay entrevistas registradas."}</p>}
      <div className="mt-3 divide-y divide-zinc-100">{interviews.map(interview => (
        <Link className="flex min-h-16 flex-wrap items-center justify-between gap-2 py-3 hover:bg-zinc-50" href={`/entrevistas/${interview.id}`} key={interview.id}>
          <div><p className="font-semibold">{interview.candidato}</p>
            <p className="text-xs text-zinc-600">{interview.fecha}{interview.puesto_aspira ? ` · ${interview.puesto_aspira}` : ""} · {interview.estado === "FINALIZADA" ? "Finalizada" : "Borrador"}</p></div>
          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${interview.estado === "FINALIZADA" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
            {interview.decision ? DECISIONS[interview.decision] : "Sin decisión"}</span>
        </Link>
      ))}</div>
    </section>
  </div>;
}
