"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { exigirDueno } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase/server";

const rating = z.number().int().min(1).max(5).nullable();
const decision = z.enum(["SI", "SI_CAPACITACION", "DUDAS", "NO"]).nullable();
const createPayload = z.object({
  fecha: z.iso.date(),
  candidato: z.string().trim().min(1).max(200),
  puesto: z.string().trim().max(200),
});
const finalizePayload = z.object({ id: z.uuid() });
const reopenPayload = z.object({ id: z.uuid(), motivo: z.string().trim().min(5).max(500) });
const savePayload = z.object({
  id: z.uuid(), fecha: z.iso.date(), candidato: z.string().trim().min(1).max(200),
  puesto: z.string().trim().max(200),
  ratings: z.object({
    tecnica: rating, velocidad: rating, prolijidad: rating, aprendizaje: rating, actitud: rating,
  }),
  decision, puestoSugerido: z.string().trim().max(200), observaciones: z.string().max(5000),
  sections: z.array(z.object({ seccion_id: z.uuid(), resultado: z.enum(["MUY_BUENO", "BUENO", "REGULAR", "MALO"]).nullable(),
    observaciones: z.string().max(2000) })).max(6),
  criteria: z.array(z.object({ criterio_id: z.uuid(), valor: z.boolean().nullable(),
    observacion: z.string().max(1000) })).max(40),
});

function invalid() {
  return { ok: false, error: "Revisa los datos de la evaluación." };
}

type ActionResult = { ok: boolean; id?: string; error?: string };

export async function crearEntrevista(input: z.input<typeof createPayload>): Promise<ActionResult> {
  try {
    await exigirDueno();
    const parsed = createPayload.safeParse(input);
    if (!parsed.success) return { ...invalid() };
    const db = await supabaseServer();
    const { data: template } = await db.from("entrevista_plantillas")
      .select("id").eq("codigo", "ENTREVISTA_PRACTICA").eq("activa", true).single();
    if (!template) return { ok: false, error: "La plantilla de entrevistas no está disponible." };
    const { data: created, error } = await db.from("entrevistas").insert({
      plantilla_id: template.id, fecha: parsed.data.fecha, candidato: parsed.data.candidato,
      puesto_aspira: parsed.data.puesto,
    }).select("id").single();
    if (error || typeof created?.id !== "string" || !z.uuid().safeParse(created.id).success) {
      return { ok: false, error: "No se pudo crear la entrevista." };
    }
    revalidatePath("/entrevistas");
    revalidatePath("/hoy");
    return { ok: true, id: created.id };
  } catch {
    return { ok: false, error: "No se pudo crear la entrevista." };
  }
}

export async function guardarEntrevista(input: z.input<typeof savePayload>): Promise<ActionResult> {
  try {
    await exigirDueno();
    const parsed = savePayload.safeParse(input);
    if (!parsed.success) return { ...invalid() };
    const data = parsed.data;
    const db = await supabaseServer();
    const { error } = await db.from("entrevistas").update({
      fecha: data.fecha, candidato: data.candidato, puesto_aspira: data.puesto,
      tecnica_actual: data.ratings.tecnica, velocidad: data.ratings.velocidad,
      prolijidad: data.ratings.prolijidad, capacidad_aprendizaje: data.ratings.aprendizaje,
      actitud: data.ratings.actitud, decision: data.decision,
      puesto_sugerido: data.puestoSugerido, observaciones_finales: data.observaciones,
    }).eq("id", data.id);
    if (error) return { ok: false, error: "No se pudo guardar la entrevista." };
    if (data.sections.length) {
      const { error: sectionsError } = await db.from("entrevista_seccion_respuestas")
        .upsert(data.sections.map(section => ({ entrevista_id: data.id, ...section })), {
          onConflict: "entrevista_id,seccion_id",
        });
      if (sectionsError) return { ok: false, error: "No se pudieron guardar los resultados por sección." };
    }
    if (data.criteria.length) {
      const { error: criteriaError } = await db.from("entrevista_criterio_respuestas")
        .upsert(data.criteria.map(criterion => ({ entrevista_id: data.id, ...criterion })), {
          onConflict: "entrevista_id,criterio_id",
        });
      if (criteriaError) return { ok: false, error: "No se pudieron guardar los criterios." };
    }
    revalidatePath("/entrevistas");
    revalidatePath(`/entrevistas/${data.id}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo guardar la entrevista." };
  }
}

export async function finalizarEntrevista(input: z.input<typeof finalizePayload>): Promise<ActionResult> {
  try {
    await exigirDueno();
    const parsed = finalizePayload.safeParse(input);
    if (!parsed.success) return { ok: false, error: "No se pudo finalizar la evaluación." };
    const db = await supabaseServer();
    const { error } = await db.rpc("finalizar_entrevista", { p_id: parsed.data.id });
    if (error?.message.includes("decision")) {
      return { ok: false, error: "Elegí una decisión antes de finalizar la entrevista." };
    }
    if (error) return { ok: false, error: "No se pudo finalizar. Comprueba el estado de la entrevista." };
    revalidatePath("/entrevistas");
    revalidatePath(`/entrevistas/${parsed.data.id}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo finalizar la entrevista." };
  }
}

export async function reabrirEntrevista(input: z.input<typeof reopenPayload>): Promise<ActionResult> {
  try {
    await exigirDueno();
    const parsed = reopenPayload.safeParse(input);
    if (!parsed.success) return { ok: false, error: "El motivo necesita entre 5 y 500 caracteres." };
    const data = parsed.data;
    const db = await supabaseServer();
    const { error } = await db.from("entrevistas")
      .update({ estado: "BORRADOR", motivo_reapertura: data.motivo })
      .eq("id", data.id).eq("estado", "FINALIZADA");
    if (error) return { ok: false, error: "No se pudo reabrir la entrevista." };
    revalidatePath("/entrevistas");
    revalidatePath(`/entrevistas/${data.id}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo reabrir la entrevista." };
  }
}
