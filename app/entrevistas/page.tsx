import Link from "next/link";
import { redirect } from "next/navigation";
import { pageSession } from "@/lib/data";
import { listInterviews } from "@/lib/interviews";
import { NewInterviewForm } from "@/components/interviews/NewInterviewForm";

const DECISIONS = { SI: "Sí", SI_CAPACITACION: "Sí con capacitación", DUDAS: "Dudas", NO: "No" } as const;

export default async function InterviewsPage() {
  const session = await pageSession();
  if (session.rol !== "DUEÑO") redirect("/hoy");
  const interviews = await listInterviews();
  return <div className="space-y-5">
    <header><p className="eyebrow">Recursos humanos</p><h1>Entrevistas prácticas</h1>
      <p className="mt-2 text-zinc-600">Evaluación privada por candidato. Visible sólo para el dueño.</p></header>
    <NewInterviewForm />
    <section className="panel"><h2>Historial</h2>
      {!interviews.length && <p className="mt-3 text-sm text-zinc-600">Todavía no hay entrevistas registradas.</p>}
      <div className="mt-3 divide-y divide-zinc-100">{interviews.map(interview => (
        <Link className="flex min-h-16 flex-wrap items-center justify-between gap-2 py-3 hover:bg-zinc-50" href={`/entrevistas/${interview.id}`} key={interview.id}>
          <div><p className="font-semibold">{interview.candidato}</p>
            <p className="text-xs text-zinc-600">{interview.fecha} · {interview.estado}</p></div>
          <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
            {interview.decision ? DECISIONS[interview.decision] : "Sin decisión"}</span>
        </Link>
      ))}</div>
    </section>
  </div>;
}
