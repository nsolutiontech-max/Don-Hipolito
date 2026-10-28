"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cerrarPlanilla, reabrirPlanilla } from "@/app/conteo/actions";

export function CierreControl({ id, estado, puedeCerrar, puedeReabrir, cerradoPor }: {
  id: string; estado: "ABIERTO" | "CERRADO"; puedeCerrar: boolean; puedeReabrir: boolean; cerradoPor: string | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [motivo, setMotivo] = useState("");
  const cerrado = estado === "CERRADO";
  const ejecutar = async (tarea: () => Promise<{ ok: boolean; error?: string }>) => {
    setSaving(true); setError("");
    try {
      const resultado = await tarea();
      if (!resultado.ok) { setError(resultado.error ?? "Operación fallida."); return; }
      router.refresh();
    } catch { setError("No se pudo conectar. Volvé a intentar."); }
    finally { setSaving(false); }
  };
  if (!cerrado && !puedeCerrar) return null;
  return <div className="panel">
    {cerrado && <p className="text-sm font-medium text-amber-900" role="status">
      Planilla cerrada{cerradoPor ? ` por ${cerradoPor}` : ""}: no admite cambios hasta que el dueño la reabra.</p>}
    {error && <p className="mt-2 text-sm text-red-700" role="status">{error}</p>}
    {cerrado && puedeReabrir && <div className="mt-3">
      <label><span className="mb-1 block text-xs font-medium text-zinc-600">Motivo de reapertura (mínimo 10 caracteres)</span>
        <textarea className="field" value={motivo} onChange={e => setMotivo(e.target.value)} minLength={10} maxLength={300} rows={2} /></label>
      <button className="button-secondary mt-2" disabled={saving || motivo.trim().length < 10}
        onClick={() => ejecutar(() => reabrirPlanilla({ id, motivo }))}>Reabrir día</button>
    </div>}
    {!cerrado && puedeCerrar && <button className="button-secondary mt-3" disabled={saving}
      onClick={() => ejecutar(() => cerrarPlanilla({ id }))}>Cerrar día</button>}
  </div>;
}
