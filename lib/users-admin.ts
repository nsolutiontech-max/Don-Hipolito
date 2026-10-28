import "server-only";
import { supabaseServer } from "@/lib/supabase/server";

export type UsuarioAdmin = {
  id: string; email: string; rol: "DUEÑO" | "ENCARGADO" | "CAMARERO";
  responsable_id: string | null; responsable_nombre: string | null; activo: boolean;
};

export async function listUsuariosAdmin(): Promise<UsuarioAdmin[]> {
  const db = await supabaseServer();
  const { data, error } = await db.from("usuarios")
    .select("id,email,rol,responsable_id,activo,responsables(nombre)").order("email");
  if (error) throw new Error("No se pudieron cargar los usuarios.");
  return (data as unknown as (UsuarioAdmin & { responsables: { nombre: string } | null })[]).map(row => ({
    ...row, responsable_nombre: row.responsables?.nombre ?? null,
  }));
}

export async function listResponsablesActivos() {
  const db = await supabaseServer();
  const { data, error } = await db.from("responsables").select("id,nombre").eq("activo", true).order("nombre");
  if (error) throw new Error("No se pudieron cargar los responsables.");
  return data;
}
