"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { exigirDueno } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase/server";

const text = (max: number) => z.string().max(max);
const response = z.object({
  item_id: z.uuid(),
  resultado: z.enum(["OK", "NO_OK"]).nullable(),
  observaciones: text(2000),
  mejora: text(2000),
  necesidad: text(2000),
});
const payload = z.object({
  fecha: z.iso.date(),
  fechaCocina: z.iso.date(),
  fechaSalon: z.iso.date(),
  observaciones: text(8000),
  firma: text(500),
  respuestas: z.array(response).max(84),
});
const closePayload = z.object({ id: z.uuid(), firma: z.string().trim().min(1).max(500) });

function safeMessage(fallback: string) {
  return fallback;
}

export async function guardarAuditoria(input: z.input<typeof payload>) {
  try {
    await exigirDueno();
    const parsed = payload.safeParse(input);
    if (!parsed.success) return { ok: false, error: safeMessage("Revisa las fechas y los datos ingresados.") };
    const data = parsed.data;
    const db = await supabaseServer();
    const { data: id, error } = await db.rpc("guardar_auditoria", {
      p_fecha: data.fecha,
      p_fecha_cocina: data.fechaCocina,
      p_fecha_salon: data.fechaSalon,
      p_observaciones: data.observaciones,
      p_firma: data.firma,
      p_respuestas: data.respuestas,
    });
    if (error) return { ok: false, error: safeMessage("No se pudo guardar la auditoría. Comprueba el estado y tus permisos.") };
    revalidatePath("/auditorias");
    revalidatePath(`/auditorias/${data.fecha}`);
    revalidatePath("/hoy");
    return { ok: true, id: id as string };
  } catch {
    return { ok: false, error: safeMessage("No se pudo guardar la auditoría.") };
  }
}

export async function cerrarAuditoria(input: z.input<typeof closePayload>) {
  try {
    await exigirDueno();
    const parsed = closePayload.safeParse(input);
    if (!parsed.success) return { ok: false, error: "La firma o aclaración es obligatoria para cerrar." };
    const db = await supabaseServer();
    const { error } = await db.rpc("cerrar_auditoria", {
      p_id: parsed.data.id, p_firma: parsed.data.firma,
    });
    if (error) return { ok: false, error: safeMessage("No se pudo cerrar. Deben estar respondidos los 84 criterios y tener firma.") };
    revalidatePath("/auditorias");
    revalidatePath("/hoy");
    return { ok: true };
  } catch {
    return { ok: false, error: safeMessage("No se pudo cerrar la auditoría.") };
  }
}
