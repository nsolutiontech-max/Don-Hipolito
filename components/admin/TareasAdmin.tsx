"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { actualizarFrecuencia } from "@/app/admin/tareas/actions";
import type { Frecuencia, TareaAdmin } from "@/lib/tasks";

const labels: Record<Frecuencia, string> = {
  DIARIA: "Diaria",
  SEMANAL: "Semanal (1 vez por semana)",
  SEGUN_NECESIDAD: "Según necesidad",
};

export function TareasAdmin({ tareas }: { tareas: TareaAdmin[] }) {
  const router = useRouter();
  const [ediciones, setEdiciones] = useState<Record<string, Frecuencia>>({});
  const [estado, setEstado] = useState<Record<string, { guardando?: boolean; ok?: boolean; error?: string }>>({});

  const guardar = async (tarea: TareaAdmin) => {
    const frecuencia = ediciones[tarea.id];
    if (!frecuencia || frecuencia === tarea.frecuencia) return;
    setEstado(prev => ({ ...prev, [tarea.id]: { guardando: true } }));
    const resultado = await actualizarFrecuencia({ id: tarea.id, frecuencia });
    setEstado(prev => ({ ...prev, [tarea.id]: resultado.ok ? { ok: true } : { error: resultado.error } }));
    if (resultado.ok) {
      setEdiciones(prev => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== tarea.id)));
      router.refresh();
    }
  };

  const grupos = (["COCINA", "SALON"] as const).map(area => ({
    area, nombre: area === "COCINA" ? "Cocina" : "Salón",
    tareas: tareas.filter(tarea => tarea.actividades.area === area),
  })).filter(grupo => grupo.tareas.length);

  return <div className="space-y-4">
    <p className="panel text-sm text-zinc-600">Las diarias se piden todos los días; las semanales, una sola vez por semana (se registran el día que se hacen); las de “según necesidad” no suman al progreso obligatorio. Los cambios impactan al instante en /tareas y /hoy.</p>
    {grupos.map(grupo => <section className="panel" key={grupo.area}><h2>{grupo.nombre} ({grupo.tareas.length})</h2>
      <ul className="mt-3 divide-y divide-zinc-100">{grupo.tareas.map(tarea => {
        const actual = ediciones[tarea.id] ?? tarea.frecuencia;
        const sucio = actual !== tarea.frecuencia;
        const msg = estado[tarea.id] ?? {};
        return <li key={tarea.id} className="flex flex-wrap items-end gap-3 py-3">
          <div className="min-w-0 flex-1"><p className="text-sm font-medium">{tarea.actividades.nombre}</p>
            <p className="text-xs text-zinc-500">{tarea.codigo}{tarea.hora_objetivo ? ` · ${tarea.hora_objetivo}` : ""}</p></div>
          <label><span className="sr-only">Frecuencia de {tarea.actividades.nombre}</span>
            <select className="field" value={actual} onChange={event => setEdiciones(prev => ({ ...prev, [tarea.id]: event.target.value as Frecuencia }))}>
              {(Object.keys(labels) as Frecuencia[]).map(frecuencia => <option key={frecuencia} value={frecuencia}>{labels[frecuencia]}</option>)}
            </select></label>
          <button type="button" className={sucio ? "button-primary" : "button-secondary"} disabled={!sucio || msg.guardando}
            onClick={() => void guardar(tarea)}>{msg.guardando ? "Guardando…" : "Guardar"}</button>
          {(msg.error || msg.ok) && <p className={`w-full text-sm ${msg.error ? "text-red-700" : "text-emerald-800"}`} role="status">{msg.error ?? "Frecuencia actualizada."}</p>}
        </li>;
      })}</ul>
    </section>)}
  </div>;
}
