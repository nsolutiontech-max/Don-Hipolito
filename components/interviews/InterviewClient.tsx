"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { guardarEntrevista } from "@/app/entrevistas/actions";
import { ProgressBar } from "@/components/ProgressBar";
import { displayDate } from "@/lib/dates";
import type { Interview, InterviewBundle, InterviewSectionResponse } from "@/lib/interviews";

type CriterionRow = { valor: boolean | null; observacion: string };
type SectionRow = { resultado: InterviewSectionResponse["resultado"]; observaciones: string };

export function InterviewClient({ data, evaluatorName }: { data: InterviewBundle; evaluatorName: string }) {
  const router = useRouter();
  const interview = data.interview!;
  const [candidate, setCandidate] = useState(interview.candidato);
  const [position, setPosition] = useState(interview.puesto_aspira);
  const [date, setDate] = useState(interview.fecha);
  const [ratings, setRatings] = useState({
    tecnica: interview.tecnica_actual, velocidad: interview.velocidad, prolijidad: interview.prolijidad,
    capacidad_aprendizaje: interview.capacidad_aprendizaje, actitud: interview.actitud,
  });
  const [decision, setDecision] = useState(interview.decision);
  const [suggestedPosition, setSuggestedPosition] = useState(interview.puesto_sugerido);
  const [observations, setObservations] = useState(interview.observaciones_finales);
  const [sectionRows, setSectionRows] = useState<Record<string, SectionRow>>(Object.fromEntries(
    data.sectionResponses.map(item => [item.seccion_id, { resultado: item.resultado, observaciones: item.observaciones }])));
  const [criterionRows, setCriterionRows] = useState<Record<string, CriterionRow>>(Object.fromEntries(
    data.criterionResponses.map(item => [item.criterio_id, { valor: item.valor, observacion: item.observacion }])));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const answered = data.criteria.filter(item => criterionRows[item.id]?.valor !== undefined && criterionRows[item.id]?.valor !== null).length;

  const save = async () => {
    setSaving(true); setMessage("");
    try {
      const result = await guardarEntrevista({
        id: interview.id, fecha: date, candidato: candidate, puesto: position,
        ratings: { tecnica: ratings.tecnica, velocidad: ratings.velocidad, prolijidad: ratings.prolijidad,
          aprendizaje: ratings.capacidad_aprendizaje, actitud: ratings.actitud },
        decision, puestoSugerido: suggestedPosition, observaciones: observations,
        sections: data.sections.map(section => ({ seccion_id: section.id, ...(sectionRows[section.id] ?? { resultado: null, observaciones: "" }) })),
        criteria: data.criteria.map(criterion => ({ criterio_id: criterion.id, ...(criterionRows[criterion.id] ?? { valor: null, observacion: "" }) })),
      });
      setMessage(result.ok ? "Evaluación guardada." : result.error ?? "No se pudo guardar.");
      if (result.ok) router.refresh();
    } catch { setMessage("No se pudo conectar. Vuelve a intentar."); }
    finally { setSaving(false); }
  };

  const ratingField = (label: string, value: number | null, onChange: (value: number | null) => void) => (
    <label><span className="mb-1 block text-sm font-medium">{label}</span>
      <select className="field" value={value ?? ""} onChange={event => onChange(event.target.value ? Number(event.target.value) : null)}>
        <option value="">Sin evaluar</option>
        {[1, 2, 3, 4, 5].map(score => <option key={score} value={score}>{score}</option>)}
      </select>
    </label>
  );

  return <div className="space-y-4">
    <Link className="button-secondary" href="/entrevistas">← Historial de entrevistas</Link>
    <header className="panel">
      <p className="eyebrow">Recursos humanos · {displayDate(date)}</p>
      <div className="flex flex-wrap items-start justify-between gap-2"><h1>Entrevista práctica</h1>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">{interview.estado}</span></div>
      <p className="mt-2 text-sm text-zinc-600">Evaluador: {evaluatorName} · {answered}/{data.criteria.length} criterios respondidos</p>
      <ProgressBar value={answered} max={data.criteria.length} label="Progreso de evaluación" />
    </header>
    <section className="panel grid gap-3 sm:grid-cols-2">
      <label><span className="mb-1 block text-sm font-medium">Candidato</span>
        <input className="field" maxLength={200} value={candidate} onChange={event => setCandidate(event.target.value)} /></label>
      <label><span className="mb-1 block text-sm font-medium">Puesto al que aspira</span>
        <input className="field" maxLength={200} value={position} onChange={event => setPosition(event.target.value)} /></label>
      <label><span className="mb-1 block text-sm font-medium">Fecha</span>
        <input className="field" type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
    </section>
    {data.sections.map(section => {
      const sectionRow = sectionRows[section.id] ?? { resultado: null, observaciones: "" };
      const items = data.criteria.filter(criterion => criterion.seccion_id === section.id);
      return <section className="panel" key={section.id}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2>{section.titulo}</h2>
          <span className="text-xs tabular-nums text-zinc-500">{items.filter(item => criterionRows[item.id]?.valor !== undefined && criterionRows[item.id]?.valor !== null).length}/{items.length}</span></div>
        {section.instruccion && <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{section.instruccion}</p>}
        <div className="space-y-4">
          {items.map(criterion => {
            const row = criterionRows[criterion.id] ?? { valor: null, observacion: "" };
            return <article className="border-t border-zinc-100 pt-4 first:border-0 first:pt-0" key={criterion.id}>
              <p className="font-medium">{criterion.texto}</p>
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`Resultado de ${criterion.texto}`}>
                {([[true, "Sí"], [false, "No"]] as const).map(([value, label]) => (
                  <button key={String(value)} type="button" aria-pressed={row.valor === value}
                    onClick={() => setCriterionRows(previous => ({ ...previous, [criterion.id]: { ...row, valor: value } }))}
                    className={`min-h-12 min-w-24 rounded-lg px-4 text-sm font-semibold ${row.valor === value ? "bg-emerald-800 text-white" : "border border-zinc-300 bg-white text-zinc-700"}`}>{label}</button>
                ))}
              </div>
              <details className="mt-2" open={Boolean(row.observacion)}>
                <summary className="min-h-12 cursor-pointer py-3 text-sm font-medium text-emerald-900">Observación {row.observacion ? " · registrada" : "(opcional)"}</summary>
                <label><span className="sr-only">Observación de {criterion.texto}</span>
                  <textarea className="field min-h-20" maxLength={1000} value={row.observacion}
                    onChange={event => setCriterionRows(previous => ({ ...previous, [criterion.id]: { ...row, observacion: event.target.value } }))} /></label>
              </details>
            </article>;
          })}
        </div>
        <div className="mt-4 grid gap-3">
          <label><span className="mb-1 block text-sm font-medium">Resultado de la sección</span>
            <select className="field" value={sectionRow.resultado ?? ""}
              onChange={event => setSectionRows(previous => ({ ...previous, [section.id]: { ...sectionRow,
                resultado: (event.target.value || null) as SectionRow["resultado"] } }))}>
              <option value="">Pendiente</option>
              <option value="MUY_BUENO">Muy bueno</option><option value="BUENO">Bueno</option>
              <option value="REGULAR">Regular</option><option value="MALO">Malo</option>
            </select></label>
          <label><span className="mb-1 block text-sm font-medium">Observaciones de la sección</span>
            <textarea className="field min-h-20" maxLength={2000} value={sectionRow.observaciones}
              onChange={event => setSectionRows(previous => ({ ...previous, [section.id]: { ...sectionRow, observaciones: event.target.value } }))} /></label>
        </div>
      </section>;
    })}
    <section className="panel">
      <h2>Evaluación final</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ratingField("Técnica actual", ratings.tecnica, value => setRatings(previous => ({ ...previous, tecnica: value })))}
        {ratingField("Velocidad", ratings.velocidad, value => setRatings(previous => ({ ...previous, velocidad: value })))}
        {ratingField("Prolijidad / orden", ratings.prolijidad, value => setRatings(previous => ({ ...previous, prolijidad: value })))}
        {ratingField("Capacidad de aprender", ratings.capacidad_aprendizaje, value => setRatings(previous => ({ ...previous, capacidad_aprendizaje: value })))}
        {ratingField("Actitud", ratings.actitud, value => setRatings(previous => ({ ...previous, actitud: value })))}
      </div>
      <fieldset className="mt-4"><legend className="mb-2 text-sm font-medium">¿Lo incorporarías?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {[["SI", "Sí"], ["SI_CAPACITACION", "Sí, pero necesita capacitación"], ["DUDAS", "Tengo dudas"], ["NO", "No"]].map(([value, label]) => (
            <button key={value} type="button" aria-pressed={decision === value} onClick={() => setDecision(value as Interview["decision"])}
              className={`min-h-12 rounded-lg px-3 text-sm font-semibold ${decision === value ? "bg-emerald-800 text-white" : "border border-zinc-300 bg-white text-zinc-700"}`}>{label}</button>
          ))}
        </div>
      </fieldset>
      <div className="mt-4 grid gap-3">
        <label><span className="mb-1 block text-sm font-medium">¿Para qué puesto lo ves?</span>
          <input className="field" maxLength={200} value={suggestedPosition} onChange={event => setSuggestedPosition(event.target.value)} /></label>
        <label><span className="mb-1 block text-sm font-medium">Observaciones finales</span>
          <textarea className="field min-h-28" maxLength={5000} value={observations} onChange={event => setObservations(event.target.value)} /></label>
      </div>
    </section>
    <div className="action-bar">
      <p role="status" className="mb-2 text-sm">{message || `${answered}/${data.criteria.length} criterios respondidos`}</p>
      <button type="button" className="button-primary w-full" disabled={saving} onClick={save}>{saving ? "Guardando…" : "Guardar evaluación"}</button>
    </div>
  </div>;
}
