import "server-only";
import { supabaseServer } from "@/lib/supabase/server";

export type TaskDefinition = {
  id: string; hora_objetivo: string | null; orden: number;
  actividades: { id: string; nombre: string; area: "COCINA" | "SALON" };
};
export type TaskRecord = { id: string; programacion_id: string; hora: string; nota: string | null; actualizado_en: string };

export async function getTasks(area: "COCINA" | "SALON", date: string) {
  const db = await supabaseServer();
  const [tasks, records] = await Promise.all([
    db.from("actividad_programaciones").select("id,hora_objetivo,orden,actividades!inner(id,nombre,area)")
      .eq("activo", true).eq("actividades.area", area).order("orden"),
    db.from("actividad_registros").select("id,programacion_id,hora,nota,actualizado_en").eq("fecha", date),
  ]);
  if (tasks.error || records.error) throw new Error("No se pudieron cargar las tareas.");
  return { tasks: tasks.data as unknown as TaskDefinition[], records: records.data as TaskRecord[] };
}
