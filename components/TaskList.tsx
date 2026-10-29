"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { completeTask } from "@/app/tareas/actions";
import { ProgressBar } from "@/components/ProgressBar";
import type { TaskDefinition, TaskRecord } from "@/lib/tasks";

function TaskRow({ task, record, date }: { task: TaskDefinition; record?: TaskRecord; date: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const now = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
  return <article className="panel">
    <div className="flex items-start justify-between gap-3"><h2 className="text-base">{task.actividades.nombre}</h2>
      <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${record ? "bg-emerald-100 text-emerald-900" : "bg-zinc-100 text-zinc-600"}`}>{record ? "Hecha" : "Pendiente"}</span>
    </div>
    {task.hora_objetivo && <p className="mt-1 text-sm text-zinc-600">Horario de referencia: {task.hora_objetivo} · Puede registrarse en cualquier momento.</p>}
    <form className="mt-3 space-y-3" action={async form => {
      setSaving(true); setError("");
      try {
        const result = await completeTask({ id: task.id, date, time: String(form.get("hora")), note: String(form.get("nota") ?? "") });
        if (!result.ok) setError(result.error ?? "No se pudo guardar.");
        else router.refresh();
      } catch { setError("No se pudo conectar. Vuelve a intentar."); }
      finally { setSaving(false); }
    }}>
      <fieldset disabled={saving} className="flex flex-wrap items-end gap-3">
        <label><span className="mb-1 block text-xs font-medium">Hora realizada</span><input className="field" name="hora" type="time" required defaultValue={record?.hora.slice(0, 5) ?? now} /></label>
        <button className={record ? "button-secondary" : "button-primary"}>{saving ? "Guardando…" : record ? "Actualizar registro" : "Completar tarea"}</button>
        <details className="w-full"><summary className="min-h-12 cursor-pointer py-3 text-sm text-zinc-600">Observaciones {record?.nota ? "registradas" : "(opcional)"}</summary>
          <label><span className="sr-only">Observaciones de {task.actividades.nombre}</span><textarea className="field min-h-24" name="nota" maxLength={2000} defaultValue={record?.nota ?? ""} /></label>
        </details>
      </fieldset>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
    </form>
  </article>;
}

export function TaskList({ tasks, records, date }: { tasks: TaskDefinition[]; records: TaskRecord[]; date: string }) {
  const [search, setSearch] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const recordMap = new Map(records.map(record => [record.programacion_id, record]));
  const visible = tasks.filter(task => task.actividades.nombre.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")) && (!pendingOnly || !recordMap.has(task.id)));
  const done = tasks.filter(task => recordMap.has(task.id)).length;
  return <div className="space-y-3"><div className="panel"><p className="font-semibold tabular-nums">{done} / {tasks.length} actividades registradas</p>
    <ProgressBar value={done} max={tasks.length} label="Progreso de tareas" /></div>
    <label className="block"><span className="sr-only">Buscar tarea</span><input className="field" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar tarea…" /></label>
    <label className="flex min-h-12 items-center gap-3 text-sm"><input className="size-5 accent-emerald-700" type="checkbox" checked={pendingOnly} onChange={e => setPendingOnly(e.target.checked)} />Mostrar sólo pendientes</label>
    {!visible.length && <p className="panel">No hay tareas que coincidan con los filtros.</p>}
    {visible.map(task => <TaskRow key={`${task.id}:${recordMap.get(task.id)?.actualizado_en ?? "pending"}`} task={task} record={recordMap.get(task.id)} date={date} />)}
  </div>;
}
