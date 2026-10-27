"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { exigirSesion } from "@/lib/data";
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
