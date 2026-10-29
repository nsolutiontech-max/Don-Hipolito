"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { completeTask } from "@/app/tareas/actions";
import { ProgressBar } from "@/components/ProgressBar";
import { displayDate } from "@/lib/dates";
import type { Frecuencia, TaskDefinition, TaskRecord } from "@/lib/tasks";

const frecuenciaLabel: Record<Frecuencia, string | null> = {
  DIARIA: null, SEMANAL: "Semanal", SEGUN_NECESIDAD: "Según necesidad",
};

function TaskRow({ task, record, date }: { task: TaskDefinition; record?: TaskRecord; date: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const now = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
  return <article className="panel">
    <div className="flex items-start justify-between gap-3"><h2 className="text-base">{task.actividades.nombre}</h2>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
        {frecuenciaLabel[task.frecuencia] && <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-900">{frecuenciaLabel[task.frecuencia]}</span>}
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${record ? "bg-emerald-100 text-emerald-900" : "bg-zinc-100 text-zinc-600"}`}>{record ? "Hecha" : "Pendiente"}</span>
      </div>
    </div>
    {task.hora_objetivo && <p className="mt-1 text-sm text-zinc-600">Horario de referencia: {task.hora_objetivo} · Puede registrarse en cualquier momento.</p>}
    {task.frecuencia === "SEMANAL" && record && <p className="mt-1 text-sm text-emerald-800">Registrada el {displayDate(record.fecha)}.</p>}
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
  const dailyRecord = (task: TaskDefinition) => records.find(record => record.programacion_id === task.id && record.fecha === date);
  const weekRecord = (task: TaskDefinition) => records.find(record => record.programacion_id === task.id);
  const recordFor = (task: TaskDefinition) => task.frecuencia === "SEMANAL" ? weekRecord(task) : dailyRecord(task);
  const matches = (task: TaskDefinition) => task.actividades.nombre.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"))
    && (!pendingOnly || !recordFor(task));
  const groups = (["DIARIA", "SEMANAL", "SEGUN_NECESIDAD"] as const).map(frecuencia => {
    const all = tasks.filter(task => task.frecuencia === frecuencia);
    return { frecuencia, all, visible: all.filter(matches) };
  });
  const [daily, weekly, optional] = groups;
  const dailyDone = daily.all.filter(task => dailyRecord(task)).length;
  const weeklyDone = weekly.all.filter(task => weekRecord(task)).length;
  const optionalDone = optional.all.filter(task => dailyRecord(task)).length;
  const renderRows = (visible: TaskDefinition[]) => visible.map(task => {
    const record = recordFor(task);
    const effectiveDate = task.frecuencia === "SEMANAL" && record ? record.fecha : date;
    return <TaskRow key={`${task.id}:${record?.actualizado_en ?? "pending"}`} task={task} record={record} date={effectiveDate} />;
  });
  return <div className="space-y-3">
    <div className="panel">
      {daily.all.length > 0 && <>
        <p className="font-semibold tabular-nums">Hoy: {dailyDone} / {daily.all.length} diarias registradas</p>
        <ProgressBar value={dailyDone} max={daily.all.length} label="Progreso de tareas" />
      </>}
      {weekly.all.length > 0 && <>
        <p className={`font-semibold tabular-nums ${daily.all.length ? "mt-3" : ""}`}>Semana: {weeklyDone} / {weekly.all.length} semanales registradas</p>
        <ProgressBar value={weeklyDone} max={weekly.all.length} label="Progreso de tareas semanales" />
      </>}
      {optional.all.length > 0 && <p className={`text-sm text-zinc-600 ${daily.all.length || weekly.all.length ? "mt-3" : ""}`}>Según necesidad: {optionalDone} / {optional.all.length} registradas hoy.</p>}
    </div>
    <label className="block"><span className="sr-only">Buscar tarea</span><input className="field" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar tarea…" /></label>
    <label className="flex min-h-12 items-center gap-3 text-sm"><input className="size-5 accent-emerald-700" type="checkbox" checked={pendingOnly} onChange={e => setPendingOnly(e.target.checked)} />Mostrar sólo pendientes</label>
    {!groups.some(group => group.visible.length) && <p className="panel">No hay tareas que coincidan con los filtros.</p>}
    {daily.visible.length > 0 && <section className="space-y-3"><h2 className="text-lg">Hoy</h2>{renderRows(daily.visible)}</section>}
    {weekly.visible.length > 0 && <section className="space-y-3"><h2 className="text-lg">Esta semana</h2>{renderRows(weekly.visible)}</section>}
    {optional.visible.length > 0 && <section className="space-y-3"><h2 className="text-lg">Según necesidad</h2>{renderRows(optional.visible)}</section>}
  </div>;
}
