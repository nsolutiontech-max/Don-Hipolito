"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { exigirSesion } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase/server";

const taskPayload = z.object({ id: z.uuid(), date: z.iso.date(), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), note: z.string().max(2000) });

export async function completeTask(input: z.input<typeof taskPayload>) {
  try {
    await exigirSesion();
    const result = taskPayload.safeParse(input);
    if (!result.success) return { ok: false, error: "Revisa la fecha, la hora y las observaciones." };
    const db = await supabaseServer();
    const { error } = await db.rpc("completar_tarea", { p_programacion: result.data.id,
      p_fecha: result.data.date, p_hora: result.data.time, p_nota: result.data.note });
    if (error) return { ok: false, error: "No se pudo guardar la tarea. Verifica tu conexión y tus permisos." };
    revalidatePath("/tareas", "layout");
    revalidatePath("/hoy");
    return { ok: true };
  } catch { return { ok: false, error: "No se pudo guardar. Vuelve a iniciar sesión e inténtalo otra vez." }; }
}
