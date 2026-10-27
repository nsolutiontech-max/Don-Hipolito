"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearEntrevista } from "@/app/entrevistas/actions";
import { fechaHoy } from "@/lib/dates";

export function NewInterviewForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  return <form className="panel grid gap-3" action={async form => {
    setSaving(true); setMessage("");
    try {
      const result = await crearEntrevista({
        fecha: String(form.get("fecha")), candidato: String(form.get("candidato")), puesto: String(form.get("puesto")),
      });
      if (!result.ok || !result.id) { setMessage(result.error ?? "No se pudo crear."); return; }
      router.push(`/entrevistas/${result.id}`);
    } catch { setMessage("No se pudo crear la entrevista."); }
    finally { setSaving(false); }
  }}>
    <label><span className="mb-1 block text-sm font-medium">Fecha</span>
      <input className="field" type="date" name="fecha" defaultValue={fechaHoy()} required /></label>
    <label><span className="mb-1 block text-sm font-medium">Candidato</span>
      <input className="field" name="candidato" maxLength={200} required placeholder="Nombre y apellido" /></label>
    <label><span className="mb-1 block text-sm font-medium">Puesto al que aspira</span>
      <input className="field" name="puesto" maxLength={200} placeholder="Cocina, mozo, etc." /></label>
    <button className="button-primary" disabled={saving}>{saving ? "Creando…" : "Crear evaluación"}</button>
    {message && <p className="text-sm text-red-700" role="alert">{message}</p>}
  </form>;
}
