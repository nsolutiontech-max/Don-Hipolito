"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cerrarAuditoria, guardarAuditoria, reabrirAuditoria } from "@/app/auditorias/actions";
import { ProgressBar } from "@/components/ProgressBar";
import { displayDate } from "@/lib/dates";
import type { Audit, AuditBlock, AuditResult, Criterion, Entrega, Part, Response } from "@/lib/audits";

type Row = { resultado: AuditResult | null; observaciones: string; mejora: string; necesidad: string };
type Props = {
  date: string; auditorName: string;
  audit: Audit | null; parts: Part[]; responses: Response[]; criteria: Criterion[];
  entregas: Entrega[];
};
const blank = (): Row => ({ resultado: null, observaciones: "", mejora: "", necesidad: "" });

export function AuditClient({ date, auditorName, audit, parts, responses, criteria, entregas }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, Row>>(() => Object.fromEntries(criteria.map(item => {
    const response = responses.find(value => value.item_id === item.id);
    return [item.id, response ? { resultado: response.resultado, observaciones: response.observaciones,
      mejora: response.mejora, necesidad: response.necesidad } : blank()];
  })));
  const [fechaCocina, setFechaCocina] = useState(parts.find(part => part.bloque === "COCINA")?.fecha ?? date);
  const [fechaSalon, setFechaSalon] = useState(parts.find(part => part.bloque === "SALON_GENERAL")?.fecha ?? date);
  const [notes, setNotes] = useState(audit?.observaciones_generales ?? "");
  const [signature, setSignature] = useState(audit?.firma ?? "");
  const [block, setBlock] = useState<AuditBlock>("COCINA");
  const [search, setSearch] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [confirmReopen, setConfirmReopen] = useState(false);
  const closed = audit?.estado === "CERRADO";
  const reopened = audit?.estado === "ABIERTO";
  const answered = criteria.filter(item => rows[item.id]?.resultado).length;
  const ok = criteria.filter(item => rows[item.id]?.resultado === "OK").length;
  const failed = answered - ok;

  useEffect(() => {
    if (!dirty || closed) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, closed]);

  const visibleGroups = useMemo(() => [...new Set(criteria.filter(c => c.bloque === block).map(c => c.grupo))], [criteria, block]);
  const update = (id: string, change: Partial<Row>) => {
    setRows(previous => ({ ...previous, [id]: { ...previous[id], ...change } }));
    setDirty(true); setMessage(""); setConfirmClose(false);
  };
  const payload = () => ({
    fecha: date, fechaCocina, fechaSalon, observaciones: notes, firma: signature,
    respuestas: criteria.map(item => ({ item_id: item.id, ...rows[item.id] })),
  });
  const save = async () => {
    setSaving(true); setMessage("");
    try {
      const result = await guardarAuditoria(payload());
      if (!result.ok) { setMessage(result.error ?? "No se pudo guardar."); return null; }
      setDirty(false); setMessage("Auditoría guardada. Puedes retomarla durante el día.");
      router.refresh();
      return result.id ?? null;
    } catch { setMessage("No se pudo conectar. Vuelve a intentar."); return null; }
    finally { setSaving(false); }
  };
  const close = async () => {
    if (answered !== criteria.length) { setMessage(`Faltan ${criteria.length - answered} criterios por responder.`); return; }
    if (!signature.trim()) { setMessage("Escribe la firma o aclaración antes de cerrar."); return; }
    setSaving(true); setMessage("");
    try {
      const id = await save();
      if (!id) return;
      const result = await cerrarAuditoria({ id, firma: signature });
      if (!result.ok) { setMessage(result.error ?? "No se pudo cerrar."); return; }
      setConfirmClose(false); setDirty(false); setMessage("Auditoría cerrada correctamente.");
      router.refresh();
    } catch { setMessage("No se pudo cerrar la auditoría."); }
    finally { setSaving(false); }
  };
  const reopen = async () => {
    if (!audit) return;
    if (motivo.trim().length < 5 || motivo.trim().length > 500) {
      setMessage("El motivo necesita entre 5 y 500 caracteres.");
      return;
    }
    setSaving(true); setMessage("");
    try {
      const result = await reabrirAuditoria({ id: audit.id, motivo: motivo });
      if (!result.ok) { setMessage(result.error ?? "No se pudo reabrir."); return; }
      setConfirmReopen(false); setMotivo(""); setMessage("Auditoría reabierta. Corrige los datos y vuelve a cerrar.");
      router.refresh();
    } catch { setMessage("No se pudo reabrir la auditoría."); }
    finally { setSaving(false); }
  };

  return <div className="space-y-4 pb-28">
    <header className="panel">
      <p className="eyebrow">Control operativo · {displayDate(date)}</p>
      <div className="flex flex-wrap items-start justify-between gap-2"><h1>Auditoría diaria</h1>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${closed ? "bg-emerald-100 text-emerald-900" : reopened ? "bg-orange-100 text-orange-900" : "bg-amber-100 text-amber-900"}`}>{closed ? "Cerrada" : reopened ? "Reabierta" : "Borrador"}</span></div>
      <p className="mt-2 text-sm text-zinc-600">Auditor: {auditorName}{closed && audit?.cerrado_en ? ` · Cerrada ${new Date(audit.cerrado_en).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}` : ""}{reopened && audit?.abierto_en ? ` · Reabierta ${new Date(audit.abierto_en).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}` : ""}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label><span className="mb-1 block text-sm font-medium">Fecha bloque Cocina</span>
          <input className="field" type="date" value={fechaCocina} disabled={closed}
            onChange={event => { setFechaCocina(event.target.value); setDirty(true); }} /></label>
        <label><span className="mb-1 block text-sm font-medium">Fecha bloque Salón / General</span>
          <input className="field" type="date" value={fechaSalon} disabled={closed}
            onChange={event => { setFechaSalon(event.target.value); setDirty(true); }} /></label>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm font-semibold tabular-nums">
        <span>{answered} / {criteria.length} respondidos</span><span className="text-emerald-800">{ok} OK</span>
        <span className="text-red-800">{failed} NO OK</span>
        <span>{closed ? `Puntaje ${ok}/${criteria.length}` : "Puntaje al cerrar"}</span>
      </div>
      <ProgressBar value={answered} max={criteria.length} label="Progreso de auditoría" />
    </header>
    {closed && (
      <section className="panel" role="status">
        <p className="text-sm text-zinc-700">Auditoría cerrada e inmutable. Firmada por: {audit?.firma}.</p>
        {!confirmReopen ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" className="button-secondary" disabled={saving}
              onClick={() => { setConfirmReopen(true); setMotivo(""); setMessage(""); }}>
              Reabrir para corregir
            </button>
            {message && <p className={`text-sm ${message.startsWith("No se") || message.includes("motivo") ? "text-red-700" : "text-zinc-700"}`}>{message}</p>}
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <label className="block"><span className="mb-1 block text-sm font-medium">Motivo de la reapertura</span>
              <textarea className="field min-h-20" maxLength={500} value={motivo}
                placeholder="¿Qué estaba mal? ¿Quién pide la corrección?"
                onChange={event => { setMotivo(event.target.value); setMessage(""); }} /></label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="button-secondary" disabled={saving}
                onClick={() => { setConfirmReopen(false); setMessage(""); }}>Cancelar</button>
              <button type="button" className="flex min-h-12 items-center justify-center rounded-lg bg-red-800 px-4 text-sm font-semibold text-white disabled:opacity-50"
                disabled={saving || motivo.trim().length < 5} onClick={reopen}>
                {saving ? "Abriendo…" : "Confirmar reapertura"}
              </button>
            </div>
            {message && <p className="text-sm text-red-700">{message}</p>}
          </div>
        )}
      </section>
    )}
    {reopened && <p className="panel border-orange-300 bg-orange-50" role="status">Auditoría reabierta{audit?.motivo_apertura ? `: ${audit.motivo_apertura}` : ""}. Corrige los datos y vuelve a cerrar con firma; la entrega anterior queda registrada en el historial.</p>}
    {entregas.length > 0 && (
      <section className="panel">
        <h2>Entregas cerradas</h2>
        <ul className="mt-2 space-y-3 text-sm">
          {entregas.map(entrega => (
            <li key={entrega.id} className="border-t border-zinc-100 pt-3 first:border-0 first:pt-0">
              <p className="font-semibold tabular-nums">Cerrada {new Date(entrega.cerrado_en).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })} · {entrega.ok}/84 OK{entrega.no_ok ? ` · ${entrega.no_ok} NO OK` : ""}</p>
              <p className="text-xs text-zinc-600">Firma: {entrega.firma || "—"}</p>
              {entrega.abierto_en && <p className="text-xs text-red-800">Reabierta {new Date(entrega.abierto_en).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })} · Motivo: {entrega.motivo_apertura}</p>}
            </li>
          ))}
        </ul>
      </section>
    )}
    <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Bloques de auditoría">
      {(["COCINA", "SALON_GENERAL"] as const).map(value => {
        const total = criteria.filter(item => item.bloque === value);
        const done = total.filter(item => rows[item.id]?.resultado).length;
        return <button key={value} role="tab" aria-selected={block === value} type="button" onClick={() => setBlock(value)}
          className={`min-h-12 rounded-lg px-3 text-sm font-semibold ${block === value ? "bg-emerald-800 text-white" : "border border-zinc-300 bg-white text-zinc-700"}`}>
          {value === "COCINA" ? "Cocina" : "Salón / General"} <span className="tabular-nums">({done}/{total.length})</span>
        </button>;
      })}
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block"><span className="sr-only">Buscar criterio</span><input className="field" placeholder="Buscar criterio…" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <label className="flex min-h-12 items-center gap-3 text-sm"><input type="checkbox" className="size-5 accent-emerald-700" checked={pendingOnly} onChange={event => setPendingOnly(event.target.checked)} />Mostrar sólo pendientes</label>
    </div>
    <fieldset disabled={saving || closed} className="space-y-4 disabled:opacity-80">
      {visibleGroups.map(group => {
        const items = criteria.filter(item => item.bloque === block && item.grupo === group
          && item.texto.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"))
          && (!pendingOnly || !rows[item.id]?.resultado));
        if (!items.length) return null;
        return <section key={group} className="panel">
          <div className="mb-3 flex items-center justify-between gap-3"><h2>{group}</h2>
            <span className="text-xs tabular-nums text-zinc-500">{items.filter(item => rows[item.id]?.resultado).length}/{items.length}</span></div>
          <div className="space-y-4">
            {items.map(item => {
              const row = rows[item.id];
              const hasNotes = Boolean(row.observaciones || row.mejora || row.necesidad);
              return <article className="border-t border-zinc-100 pt-4 first:border-0 first:pt-0" key={item.id}>
                <p className="font-medium leading-snug">{item.texto}</p>
                <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`Resultado de ${item.texto}`}>
                  {(["OK", "NO_OK"] as const).map(result => <button key={result} type="button" aria-pressed={row.resultado === result}
                    onClick={() => update(item.id, { resultado: row.resultado === result ? null : result })}
                    className={`min-h-12 min-w-24 rounded-lg px-4 text-sm font-semibold ${row.resultado === result
                      ? result === "OK" ? "bg-emerald-800 text-white" : "bg-red-800 text-white"
                      : "border border-zinc-300 bg-white text-zinc-700"}`}>{result === "OK" ? "OK" : "NO OK"}</button>)}
                  {row.resultado && <button type="button" className="min-h-12 text-sm text-zinc-600 underline" onClick={() => update(item.id, { resultado: null })}>Limpiar</button>}
                </div>
                <details className="mt-2" open={hasNotes}>
                  <summary className="min-h-12 cursor-pointer py-3 text-sm font-medium text-emerald-900">Observaciones y acciones{hasNotes ? " · completadas" : " (opcional)"}</summary>
                  <div className="grid gap-3">
                    <label><span className="mb-1 block text-xs font-medium">Observaciones generales</span>
                      <textarea className="field min-h-20" maxLength={2000} value={row.observaciones}
                        onChange={event => update(item.id, { observaciones: event.target.value })} /></label>
                    <label><span className="mb-1 block text-xs font-medium">Qué se puede mejorar</span>
                      <textarea className="field min-h-20" maxLength={2000} value={row.mejora}
                        onChange={event => update(item.id, { mejora: event.target.value })} /></label>
                    <label><span className="mb-1 block text-xs font-medium">Qué necesita el encargado</span>
                      <textarea className="field min-h-20" maxLength={2000} value={row.necesidad}
                        onChange={event => update(item.id, { necesidad: event.target.value })} /></label>
                  </div>
                </details>
              </article>;
            })}
          </div>
        </section>;
      })}
      {!visibleGroups.some(group => criteria.some(item => item.bloque === block && item.grupo === group
        && item.texto.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"))
        && (!pendingOnly || !rows[item.id]?.resultado))) && <p className="panel">No hay criterios que coincidan con los filtros.</p>}
      <section className="panel">
        <h2>Resultado general</h2>
        <label className="mt-3 block"><span className="mb-1 block text-sm font-medium">Observaciones generales</span>
          <textarea className="field min-h-28" maxLength={8000} value={notes} onChange={event => { setNotes(event.target.value); setDirty(true); }} /></label>
        <label className="mt-3 block"><span className="mb-1 block text-sm font-medium">Firma / aclaración</span>
          <input className="field" maxLength={500} value={signature} placeholder="Nombre y apellido"
            onChange={event => { setSignature(event.target.value); setDirty(true); }} /></label>
        <p className="mt-2 text-xs text-zinc-600">La firma y los 84 criterios son obligatorios para cerrar. Guardar como borrador no requiere firma.</p>
      </section>
    </fieldset>
    {!closed && <div className="action-bar">
      <p role="status" className={`mb-2 text-sm ${message.includes("No se") || message.includes("Faltan") ? "text-red-700" : "text-zinc-700"}`}>
        {message || (dirty ? "Hay cambios pendientes de guardar" : "Puedes guardar parcialmente durante el día")}
      </p>
      {!confirmClose ? <div className="flex gap-2">
        <button type="button" className="button-primary flex-1" disabled={saving || closed} onClick={save}>{saving ? "Guardando…" : "Guardar borrador"}</button>
        <button type="button" className="button-secondary flex-1" disabled={saving || answered !== criteria.length || !signature.trim()}
          onClick={() => { setConfirmClose(true); setMessage("Revisa el resultado. Confirma el cierre para bloquear la auditoría."); }}>Cerrar auditoría</button>
      </div> : <div className="flex gap-2">
        <button type="button" className="button-secondary flex-1" disabled={saving} onClick={() => setConfirmClose(false)}>Cancelar</button>
        <button type="button" className="flex min-h-12 flex-1 items-center justify-center rounded-lg bg-red-800 px-4 text-sm font-semibold text-white disabled:opacity-50"
          disabled={saving} onClick={close}>{saving ? "Cerrando…" : `Confirmar cierre (${ok}/84 OK)`}</button>
      </div>}
    </div>}
  </div>;
}
