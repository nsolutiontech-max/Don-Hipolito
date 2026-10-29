import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { canOperate } from "@/lib/permissions";
import type { Catalogo, InventoryCatalog, InventoryRecord, InventorySheet, Movimiento, SesionUsuario, SheetCode } from "@/lib/types";
export type * from "@/lib/types";
export { fechaHoy } from "@/lib/dates";

export const getSesionUsuario = cache(async (): Promise<SesionUsuario | null> => {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user?.email) return null;
  const { data, error } = await db.from("usuarios")
    .select("id,email,rol,responsable_id,responsables(nombre)").eq("id", user.id).eq("activo", true).maybeSingle();
  if (error || !data) return null;
  const responsible = data.responsables as unknown as { nombre: string } | null;
  return { id: data.id, email: data.email, rol: data.rol, responsable_id: data.responsable_id,
    responsable_nombre: responsible?.nombre ?? null };
});

export async function exigirSesion() {
  const session = await getSesionUsuario();
  if (!session) throw new Error("Sesión requerida.");
  return session;
}

export async function exigirOperador() {
  const session = await exigirSesion();
  if (!canOperate(session.rol)) throw new Error("No tienes permiso para esta operación.");
  return session;
}

export async function exigirDueno() {
  const session = await exigirSesion();
  if (session.rol !== "DUEÑO") throw new Error("Acceso exclusivo del dueño.");
  return session;
}

export async function pageSession(operationsOnly = false) {
  const session = await getSesionUsuario();
  if (!session) redirect("/login");
  if (operationsOnly && !canOperate(session.rol)) redirect("/hoy");
  return session;
}

export async function getSheets(): Promise<InventorySheet[]> {
  const db = await supabaseServer();
  const { data, error } = await db.from("planillas_inventario").select("*").eq("activo", true).order("orden");
  if (error) throw new Error("No se pudieron cargar las planillas.");
  return data;
}

export async function getInventoryCatalog(code: SheetCode): Promise<InventoryCatalog | null> {
  const db = await supabaseServer();
  const { data: sheet, error } = await db.from("planillas_inventario").select("*").eq("codigo", code).eq("activo", true).maybeSingle();
  if (error) throw new Error("No se pudo cargar la planilla.");
  if (!sheet) return null;
  const [sections, items] = await Promise.all([
    db.from("planilla_secciones").select("id,nombre,orden").eq("planilla_id", sheet.id).eq("activo", true).order("orden"),
    db.from("planilla_items").select("seccion_id,orden,productos(*)").eq("planilla_id", sheet.id).eq("activo", true).order("orden"),
  ]);
  if (sections.error || items.error) throw new Error("No se pudo cargar el catálogo de la planilla.");
  const products = items.data.map(item => ({
    ...(item.productos as unknown as InventoryCatalog["products"][number]), seccion_id: item.seccion_id, orden: item.orden,
  }));
  return { sheet, sections: sections.data, products };
}

export async function getInventory(sheetId: string, date: string) {
  const db = await supabaseServer();
  const { data, error } = await db.from("inventarios").select("*").eq("planilla_id", sheetId).eq("fecha", date).maybeSingle();
  if (error) throw new Error("No se pudo cargar el inventario.");
  const inventory = data as InventoryRecord | null;
  if (!inventory) return { inventory: null, details: [] };
  const details = await db.from("inventario_detalles").select("*").eq("inventario_id", inventory.id);
  if (details.error) throw new Error("No se pudo cargar el conteo.");
  return { inventory, details: details.data };
}

export async function getCatalogo(): Promise<Catalogo> {
  const db = await supabaseServer();
  const [cats, products, responsible] = await Promise.all([
    db.from("categorias").select("*").order("orden"),
    db.from("productos").select("*").eq("activo", true).order("nombre"),
    db.from("responsables").select("id,nombre").eq("activo", true).order("nombre"),
  ]);
  if (cats.error || products.error || responsible.error) throw new Error("No se pudo cargar el catálogo.");
  return { categorias: cats.data, productos: products.data, responsables: responsible.data };
}

export async function getMovimientosRecientes(limit = 20): Promise<Movimiento[]> {
  const db = await supabaseServer();
  const { data, error } = await db.from("movimientos").select("*").order("fecha", { ascending: false }).limit(limit);
  if (error) throw new Error("No se pudieron cargar los movimientos.");
  return data;
}

export async function guardarMovimiento(input: Omit<Movimiento, "id" | "fecha">) {
  const db = await supabaseServer();
  const { error } = await db.from("movimientos").insert(input);
  if (error) throw new Error("No se pudo guardar el movimiento.");
}
