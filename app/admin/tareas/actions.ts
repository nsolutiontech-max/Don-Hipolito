"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { exigirDueno } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase/server";

const payload = z.object({
  id: z.uuid(),
  frecuencia: z.enum(["DIARIA", "SEMANAL", "SEGUN_NECESIDAD"]),
});

type ActionResult = { ok: boolean; error?: string };

export async function actualizarFrecuencia(input: z.input<typeof payload>): Promise<ActionResult> {
  try {
    await exigirDueno();
    const parsed = payload.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Revisá la frecuencia elegida." };
    const db = await supabaseServer();
    const { data, error } = await db.from("actividad_programaciones")
      .update({ frecuencia: parsed.data.frecuencia }).eq("id", parsed.data.id).select("id");
    if (error) return { ok: false, error: "No se pudo actualizar la frecuencia." };
    if (!data?.length) return { ok: false, error: "La tarea no existe o no tenés permiso." };
    revalidatePath("/admin/tareas");
    revalidatePath("/tareas");
    revalidatePath("/tareas/semana");
    revalidatePath("/hoy");
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo actualizar la frecuencia." };
  }
}
