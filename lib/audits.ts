import "server-only";
import { supabaseServer } from "@/lib/supabase/server";

export type AuditBlock = "COCINA" | "SALON_GENERAL";
export type AuditResult = "OK" | "NO_OK";
export type Criterion = {
  id: string; codigo: string; bloque: AuditBlock; grupo: string;
  texto: string; orden: number; orden_bloque: number;
};
export type Response = {
  item_id: string; resultado: AuditResult | null;
  observaciones: string; mejora: string; necesidad: string;
};
export type Part = { bloque: AuditBlock; fecha: string; auditor_id: string; usuarios: { email: string } | null };
export type Audit = {
  id: string; plantilla_id: string; fecha: string; estado: "BORRADOR" | "CERRADO";
  observaciones_generales: string; firma: string; actualizado_en: string; cerrado_en: string | null;
};
export type AuditSummary = Audit & { auditoria_respuestas: { resultado: AuditResult | null }[] };

export async function getAuditTemplate() {
  const db = await supabaseServer();
  const template = await db.from("auditoria_plantillas")
    .select("id,codigo,nombre,version").eq("codigo", "AUDITORIA_2026").eq("activa", true).single();
  if (template.error) throw new Error("No se pudo cargar la plantilla de auditoría.");
  const items = await db.from("auditoria_items").select("*").eq("plantilla_id", template.data.id).order("orden");
  if (items.error) throw new Error("No se pudieron cargar los criterios de auditoría.");
  return { template: template.data, items: items.data as Criterion[] };
}

export async function getAudit(date: string) {
  const db = await supabaseServer();
  const auditResult = await db.from("auditorias").select("*").eq("fecha", date).maybeSingle();
  if (auditResult.error) throw new Error("No se pudo cargar la auditoría.");
  const audit = auditResult.data as Audit | null;
  if (!audit) return { audit: null, parts: [] as Part[], responses: [] as Response[] };
  const [parts, responses] = await Promise.all([
    db.from("auditoria_partes").select("bloque,fecha,auditor_id,usuarios(email)").eq("auditoria_id", audit.id),
    db.from("auditoria_respuestas")
      .select("item_id,resultado,observaciones,mejora,necesidad").eq("auditoria_id", audit.id),
  ]);
  if (parts.error || responses.error) throw new Error("No se pudo cargar el detalle de la auditoría.");
  return { audit, parts: parts.data as unknown as Part[], responses: responses.data as Response[] };
}

export async function listAudits(limit = 20): Promise<AuditSummary[]> {
  const db = await supabaseServer();
  const { data, error } = await db.from("auditorias")
    .select("id,plantilla_id,fecha,estado,observaciones_generales,firma,actualizado_en,cerrado_en,auditoria_respuestas(resultado)")
    .order("fecha", { ascending: false }).limit(limit);
  if (error) throw new Error("No se pudo cargar el historial de auditorías.");
  return data as unknown as AuditSummary[];
}
