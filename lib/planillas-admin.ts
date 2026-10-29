import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import type { Producto, SheetCode } from "@/lib/types";

export type PlanillaItemAdmin = {
  id: string; seccion_id: string; orden: number; producto_id: string;
  nombre: string; presentacion: string; unidad_medida: string;
};
export type PlanillaSeccionAdmin = { id: string; nombre: string; orden: number; items: PlanillaItemAdmin[] };
export type PlanillaAdmin = {
  id: string; codigo: SheetCode; nombre: string; modo: string; orden: number;
  secciones: PlanillaSeccionAdmin[];
};
export type ProductoOpcion = { id: string; nombre: string; categoria_nombre: string; unidad_medida: string };

export async function getPlanillasAdmin(): Promise<PlanillaAdmin[]> {
  const db = await supabaseServer();
  const [planillas, secciones, items] = await Promise.all([
    db.from("planillas_inventario").select("id,codigo,nombre,modo,orden").eq("activo", true).order("orden"),
    db.from("planilla_secciones").select("id,planilla_id,nombre,orden").eq("activo", true).order("orden"),
    db.from("planilla_items").select("id,planilla_id,seccion_id,orden,producto_id,productos(nombre,presentacion,unidad_medida)")
      .eq("activo", true).order("orden"),
  ]);
  if (planillas.error || secciones.error || items.error) throw new Error("No se pudieron cargar las planillas.");

  const seccionesPorPlanilla = new Map<string, PlanillaSeccionAdmin[]>();
  const seccionPorId = new Map<string, PlanillaSeccionAdmin>();
  for (const seccion of secciones.data as unknown as { id: string; planilla_id: string; nombre: string; orden: number }[]) {
    const item: PlanillaSeccionAdmin = { id: seccion.id, nombre: seccion.nombre, orden: seccion.orden, items: [] };
    seccionPorId.set(seccion.id, item);
    seccionesPorPlanilla.set(seccion.planilla_id, [...(seccionesPorPlanilla.get(seccion.planilla_id) ?? []), item]);
  }
  for (const item of items.data as unknown as {
    id: string; planilla_id: string; seccion_id: string; orden: number; producto_id: string;
    productos: { nombre: string; presentacion: string; unidad_medida: string } | null;
  }[]) {
    seccionPorId.get(item.seccion_id)?.items.push({
      id: item.id, seccion_id: item.seccion_id, orden: item.orden, producto_id: item.producto_id,
      nombre: item.productos?.nombre ?? "Producto", presentacion: item.productos?.presentacion ?? "",
      unidad_medida: item.productos?.unidad_medida ?? "POR_DEFINIR",
    });
  }
  return (planillas.data as unknown as { id: string; codigo: SheetCode; nombre: string; modo: string; orden: number }[])
    .map(planilla => ({ ...planilla, secciones: seccionesPorPlanilla.get(planilla.id) ?? [] }));
}

export async function getProductosOpcion(): Promise<ProductoOpcion[]> {
  const db = await supabaseServer();
  const { data, error } = await db.from("productos").select("id,nombre,unidad_medida,categorias(nombre)")
    .eq("activo", true).order("nombre");
  if (error) throw new Error("No se pudieron cargar los productos.");
  return (data as unknown as (Pick<Producto, "id" | "nombre" | "unidad_medida"> & { categorias: { nombre: string } | null })[])
    .map(producto => ({
      id: producto.id, nombre: producto.nombre, unidad_medida: producto.unidad_medida,
      categoria_nombre: producto.categorias?.nombre ?? "Sin categoría",
    }));
}
