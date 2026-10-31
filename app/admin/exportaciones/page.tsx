import Link from "next/link";
import { exigirDueno, fechaHoy } from "@/lib/data";
import { listAudits } from "@/lib/audits";
import { listInterviews } from "@/lib/interviews";
import { displayDate } from "@/lib/dates";
import { z } from "zod";

const EXPORT_TYPES = [
  { value: "STOCK_A", label: "Stock A" },
  { value: "STOCK_B", label: "Stock B" },
  { value: "STOCK_C", label: "Stock C" },
  { value: "BEBIDAS", label: "Bebidas (Depósito/Heladera)" },
  { value: "TAREAS_DIARIA", label: "Tareas (diaria)" },
  { value: "TAREAS_SEMANAL", label: "Tareas (semanal)" },
  { value: "AUDITORIA", label: "Auditoría diaria" },
  { value: "ENTREVISTA", label: "Entrevista práctica" },
] as const;

export default async function ExportacionesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await exigirDueno();
  const [audits, interviews] = await Promise.all([listAudits(50), listInterviews(50)]);
  const today = fechaHoy();

  const params = await searchParams;
  const tipo = params.tipo as (typeof EXPORT_TYPES)[number]["value"] | undefined;
  const fecha = params.fecha && z.iso.date().safeParse(params.fecha).success ? params.fecha : today;
  const auditoriaId = params.auditoria_id;
  const entrevistaId = params.entrevista_id;

  const needsDate = tipo && !["ENTREVISTA"].includes(tipo);
  const needsAudit = tipo === "AUDITORIA";
  const needsInterview = tipo === "ENTREVISTA";

  return (
    <div className="space-y-5">
      <header>
        <p className="eyebrow">Administración</p>
        <h1>Exportar PDF</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Generá PDFs listos para imprimir (A4). Stock y tareas en vertical; auditoría en horizontal.
          Seleccioná el tipo, la fecha (o ítem) y descargá.
        </p>
      </header>

      <form className="panel space-y-4" action="/admin/exportaciones/descargar" method="get">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Tipo de exportación</span>
            <select name="tipo" className="field" required>
              <option value="" disabled>Elegir…</option>
              {EXPORT_TYPES.map(t => (
                <option key={t.value} value={t.value} selected={tipo === t.value}>{t.label}</option>
              ))}
            </select>
          </label>

          {needsDate && (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Fecha</span>
              <input type="date" name="fecha" className="field" defaultValue={fecha} required max={today} />
            </label>
          )}

          {needsAudit && (
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-sm font-medium">Auditoría (opcional: si no se elige, usa la fecha)</span>
              <select name="auditoria_id" className="field">
                <option value="">Usar la fecha seleccionada</option>
                {audits.map(a => {
                  const okCount = (a.auditoria_respuestas ?? []).filter((r: { resultado?: string | null }) => r.resultado === "OK").length;
                  return (
                    <option key={a.id} value={a.id} selected={auditoriaId === a.id}>
                      {displayDate(a.fecha)} · {a.estado} · {okCount}/84 OK
                    </option>
                  );
                })}
              </select>
            </label>
          )}

          {needsInterview && (
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-sm font-medium">Entrevista</span>
              <select name="entrevista_id" className="field" required>
                <option value="" disabled>Elegir entrevista…</option>
                {interviews.map(i => (
                  <option key={i.id} value={i.id} selected={entrevistaId === i.id}>
                    {displayDate(i.fecha)} · {i.candidato} · {i.estado} · {i.decision ?? "Sin decisión"}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="flex gap-2">
          <button type="submit" className="button-primary">Generar y descargar PDF</button>
          <Link className="button-secondary self-center" href="/admin">Volver a administración</Link>
        </div>
      </form>

      <div className="panel space-y-3">
        <p className="font-semibold">Formatos por tipo</p>
        <ul className="text-sm text-zinc-600 space-y-1 ml-4 list-disc">
          <li><strong>Stock A / B / C / Bebidas:</strong> A4 vertical, columnas por sección, totales D/H en bebidas, observaciones al pie.</li>
          <li><strong>Tareas diaria:</strong> A4 vertical, tareas de Cocina y Salón con hora objetivo y nota del día.</li>
          <li><strong>Tareas semanal:</strong> A4 vertical, matriz día×tarea por área + resumen semanal y según necesidad.</li>
          <li><strong>Auditoría:</strong> A4 horizontal, 84 criterios en tabla (Cocina / Salón), resultado, observaciones, mejora, necesidad.</li>
          <li><strong>Entrevista:</strong> A4 vertical, datos del candidato, criterios por sección con ✓/✗, valoraciones 1–5, decisión final.</li>
        </ul>
      </div>
    </div>
  );
}