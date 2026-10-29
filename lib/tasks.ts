import "server-only";
import { inicioSemana, sumarDias } from "@/lib/dates";
import { supabaseServer } from "@/lib/supabase/server";

export type Frecuencia = "DIARIA" | "SEMANAL" | "SEGUN_NECESIDAD";
export type TaskDefinition = {
  id: string; hora_objetivo: string | null; orden: number; frecuencia: Frecuencia;
  actividades: { id: string; nombre: string; area: "COCINA" | "SALON" };
};
export type TaskRecord = {
  id: string; programacion_id: string; fecha: string; hora: string;
  nota: string | null; actualizado_en: string;
};

export async function getTasks(area: "COCINA" | "SALON", date: string) {
  const db = await supabaseServer();
  const weekStart = inicioSemana(date);
  const weekEnd = sumarDias(weekStart, 6);
  const [tasks, records] = await Promise.all([
    db.from("actividad_programaciones").select("id,hora_objetivo,orden,frecuencia,actividades!inner(id,nombre,area)")
      .eq("activo", true).eq("actividades.area", area).order("orden"),
    db.from("actividad_registros").select("id,programacion_id,fecha,hora,nota,actualizado_en")
      .gte("fecha", weekStart).lte("fecha", weekEnd),
  ]);
  if (tasks.error || records.error) throw new Error("No se pudieron cargar las tareas.");
  return {
    tasks: tasks.data as unknown as TaskDefinition[],
    records: records.data as unknown as TaskRecord[],
    weekStart, weekEnd,
  };
}

export type WeekDay = { fecha: string; total: number; hechas: number };
export type WeekArea = {
  area: "COCINA" | "SALON"; nombre: string; dias: WeekDay[];
  semanal: { total: number; hechas: number };
  semanalDetalle: { id: string; nombre: string; fecha: string | null }[];
  opcional: { total: number; hechas: number };
};

export async function getWeekSummary(date: string) {
  const db = await supabaseServer();
  const weekStart = inicioSemana(date);
  const weekEnd = sumarDias(weekStart, 6);
  const [tasks, records] = await Promise.all([
    db.from("actividad_programaciones").select("id,orden,frecuencia,actividades!inner(nombre,area)")
      .eq("activo", true).order("orden"),
    db.from("actividad_registros").select("programacion_id,fecha").gte("fecha", weekStart).lte("fecha", weekEnd),
  ]);
  if (tasks.error || records.error) throw new Error("No se pudo cargar la vista semanal.");
  const programs = tasks.data as unknown as {
    id: string; frecuencia: Frecuencia; actividades: { nombre: string; area: "COCINA" | "SALON" };
  }[];
  const datesByTask = new Map<string, Set<string>>();
  for (const record of records.data as { programacion_id: string; fecha: string }[]) {
    const dates = datesByTask.get(record.programacion_id) ?? new Set<string>();
    dates.add(record.fecha);
    datesByTask.set(record.programacion_id, dates);
  }
  const days = Array.from({ length: 7 }, (_, index) => sumarDias(weekStart, index));
  const areas = (["COCINA", "SALON"] as const).flatMap((area): WeekArea[] => {
    const areaPrograms = programs.filter(program => program.actividades?.area === area);
    if (!areaPrograms.length) return [];
    const diarias = areaPrograms.filter(program => program.frecuencia === "DIARIA");
    const semanales = areaPrograms.filter(program => program.frecuencia === "SEMANAL");
    const opcionales = areaPrograms.filter(program => program.frecuencia === "SEGUN_NECESIDAD");
    return [{
      area, nombre: area === "COCINA" ? "Cocina" : "Salón",
      dias: days.map(fecha => ({
        fecha, total: diarias.length,
        hechas: diarias.filter(program => datesByTask.get(program.id)?.has(fecha)).length,
      })),
      semanal: {
        total: semanales.length,
        hechas: semanales.filter(program => datesByTask.has(program.id)).length,
      },
      semanalDetalle: semanales.map(program => ({
        id: program.id, nombre: program.actividades.nombre,
        fecha: [...(datesByTask.get(program.id) ?? [])].sort()[0] ?? null,
      })),
      opcional: {
        total: opcionales.length,
        hechas: opcionales.filter(program => datesByTask.has(program.id)).length,
      },
    }];
  });
  return { weekStart, weekEnd, days, areas };
}

export type TareaAdmin = {
  id: string; codigo: string; hora_objetivo: string | null; frecuencia: Frecuencia;
  actividades: { nombre: string; area: "COCINA" | "SALON" };
};

export async function getTareasAdmin(): Promise<TareaAdmin[]> {
  const db = await supabaseServer();
  const { data, error } = await db.from("actividad_programaciones")
    .select("id,codigo,hora_objetivo,frecuencia,actividades!inner(nombre,area)")
    .eq("activo", true).order("orden");
  if (error) throw new Error("No se pudieron cargar las tareas.");
  return data as unknown as TareaAdmin[];
}
