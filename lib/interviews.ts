import "server-only";
import { supabaseServer } from "@/lib/supabase/server";

export type InterviewSection = {
  id: string; codigo: string; titulo: string; instruccion: string; orden: number;
};
export type InterviewCriterion = {
  id: string; seccion_id: string; codigo: string; texto: string; orden: number;
};
export type InterviewSectionResponse = {
  seccion_id: string; resultado: "MUY_BUENO" | "BUENO" | "REGULAR" | "MALO" | null; observaciones: string;
};
export type InterviewCriterionResponse = {
  criterio_id: string; valor: boolean | null; observacion: string;
};
export type Interview = {
  id: string; plantilla_id: string; fecha: string; candidato: string; puesto_aspira: string;
  estado: "BORRADOR" | "FINALIZADA"; finalizada_en: string | null; motivo_reapertura: string;
  tecnica_actual: number | null; velocidad: number | null; prolijidad: number | null;
  capacidad_aprendizaje: number | null; actitud: number | null;
  decision: "SI" | "SI_CAPACITACION" | "DUDAS" | "NO" | null;
  puesto_sugerido: string; observaciones_finales: string; actualizado_en: string;
};
export type InterviewBundle = {
  interview: Interview | null; sections: InterviewSection[]; criteria: InterviewCriterion[];
  sectionResponses: InterviewSectionResponse[]; criterionResponses: InterviewCriterionResponse[];
};
export type InterviewSummary = Pick<Interview, "id" | "fecha" | "candidato" | "puesto_aspira" | "estado" | "decision" | "actualizado_en">;

export async function getInterviewTemplate() {
  const db = await supabaseServer();
  const template = await db.from("entrevista_plantillas")
    .select("id,codigo,nombre,version").eq("codigo", "ENTREVISTA_PRACTICA").eq("activa", true).single();
  if (template.error) throw new Error("No se pudo cargar la plantilla de entrevistas.");
  const [sections, criteria] = await Promise.all([
    db.from("entrevista_secciones").select("*").eq("plantilla_id", template.data.id).order("orden"),
    db.from("entrevista_criterios").select("*").eq("plantilla_id", template.data.id).order("orden"),
  ]);
  if (sections.error || criteria.error) throw new Error("No se pudo cargar la evaluación práctica.");
  return { template: template.data, sections: sections.data as InterviewSection[], criteria: criteria.data as InterviewCriterion[] };
}

export async function getInterview(id: string): Promise<InterviewBundle> {
  const db = await supabaseServer();
  const { data: interview, error } = await db.from("entrevistas").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("No se pudo cargar la entrevista.");
  if (!interview) return { interview: null, sections: [], criteria: [], sectionResponses: [], criterionResponses: [] };
  const [sections, criteria, sectionResponses, criterionResponses] = await Promise.all([
    db.from("entrevista_secciones").select("*").eq("plantilla_id", interview.plantilla_id).order("orden"),
    db.from("entrevista_criterios").select("*").eq("plantilla_id", interview.plantilla_id).order("orden"),
    db.from("entrevista_seccion_respuestas").select("seccion_id,resultado,observaciones").eq("entrevista_id", id),
    db.from("entrevista_criterio_respuestas").select("criterio_id,valor,observacion").eq("entrevista_id", id),
  ]);
  if (sections.error || criteria.error || sectionResponses.error || criterionResponses.error) {
    throw new Error("No se pudo cargar el detalle de la entrevista.");
  }
  return {
    interview: interview as Interview,
    sections: sections.data as InterviewSection[],
    criteria: criteria.data as InterviewCriterion[],
    sectionResponses: sectionResponses.data as InterviewSectionResponse[],
    criterionResponses: criterionResponses.data as InterviewCriterionResponse[],
  };
}

export async function listInterviews(limit = 20, query?: string): Promise<InterviewSummary[]> {
  const db = await supabaseServer();
  const trimmed = query?.trim();
  const base = db.from("entrevistas").select("id,fecha,candidato,puesto_aspira,estado,decision,actualizado_en");
  const filtered = trimmed
    ? base.or(`candidato.ilike.%${encodeURIComponent(trimmed)}%,puesto_aspira.ilike.%${encodeURIComponent(trimmed)}%`)
    : base;
  const { data, error } = await filtered.order("creado_en", { ascending: false }).limit(limit);
  if (error) throw new Error("No se pudo cargar el historial de entrevistas.");
  return data;
}
