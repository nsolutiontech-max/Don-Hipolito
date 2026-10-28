"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { exigirSesion, exigirOperador, exigirDueno } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase/server";

const quantity = z.number().finite().min(0).max(99999999.99).nullable();
const payload = z.object({
  sheetId: z.uuid(), date: z.iso.date(), notes: z.string().max(4000),
  details: z.array(z.object({ producto_id: z.uuid(), ubicacion: z.enum(["GENERAL", "DEPOSITO", "HELADERA"]),
    stock_real: quantity, cantidad_pedida: quantity, es_ajuste_manual: z.boolean() })).max(500),
});

export async function guardarConteo(input: z.input<typeof payload>): Promise<{ ok: boolean; id?: string; version?: string; error?: string }> {
  try {
    await exigirSesion();
    const parsed = payload.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Revisa la fecha y las cantidades ingresadas." };
    const data = parsed.data;
    const db = await supabaseServer();
    const { data: id, error } = await db.rpc("guardar_inventario", {
      p_planilla_id: data.sheetId, p_fecha: data.date, p_detalles: data.details, p_observaciones: data.notes,
    });
    if (error) return { ok: false, error: "No se pudo guardar. Verifica tu conexión y tus permisos." };
    const saved = await db.from("inventarios").select("actualizado_en").eq("id", id).single();
    revalidatePath("/hoy");
    return { ok: true, id, version: saved.data?.actualizado_en };
  } catch {
    return { ok: false, error: "No se pudo guardar. Inicia sesión y vuelve a intentar." };
  }
}

const idPayload = z.object({ id: z.uuid() });
const reaperturaPayload = z.object({ id: z.uuid(), motivo: z.string().trim().min(10).max(300) });

export async function cerrarPlanilla(input: z.input<typeof idPayload>): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await exigirOperador();
    const parsed = idPayload.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Inventario no válido." };
    const db = await supabaseServer();
    const { data, error } = await db.from("inventarios")
      .update({ estado: "CERRADO", cerrado_por: session.id, cerrado_en: new Date().toISOString() })
      .eq("id", parsed.data.id).select("id");
    if (error) return { ok: false, error: "No se pudo cerrar la planilla." };
    if (!data?.length) return { ok: false, error: "Inventario no encontrado o sin permiso." };
    revalidatePath("/hoy");
    revalidatePath("/conteo/[planilla]/[fecha]", "page");
    return { ok: true };
  } catch { return { ok: false, error: "No se pudo cerrar la planilla." }; }
}

export async function reabrirPlanilla(input: z.input<typeof reaperturaPayload>): Promise<{ ok: boolean; error?: string }> {
  try {
    await exigirDueno();
    const parsed = reaperturaPayload.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Necesitás un motivo de al menos 10 caracteres para reabrir." };
    const db = await supabaseServer();
    const { data, error } = await db.from("inventarios")
      .update({ estado: "ABIERTO", motivo_apertura: parsed.data.motivo, cerrado_por: null, cerrado_en: null })
      .eq("id", parsed.data.id).select("id");
    if (error) return { ok: false, error: "No se pudo reabrir la planilla." };
    if (!data?.length) return { ok: false, error: "Inventario no encontrado o sin permiso." };
    revalidatePath("/hoy");
    revalidatePath("/conteo/[planilla]/[fecha]", "page");
    return { ok: true };
  } catch { return { ok: false, error: "No se pudo reabrir la planilla." }; }
}
