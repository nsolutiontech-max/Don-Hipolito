import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import type { Categoria, Producto } from "@/lib/types";

export type AdminProducto = Producto & { planillas: string[]; categoria_nombre: string };

export async function getCatalogoAdmin(): Promise<{ categorias: Categoria[]; productos: AdminProducto[] }> {
  const db = await supabaseServer();
  const [cats, prods, links] = await Promise.all([
    db.from("categorias").select("id,nombre,orden").order("orden"),
    db.from("productos").select("*,categorias(nombre)").order("nombre"),
    db.from("planilla_items").select("producto_id,planillas_inventario(codigo)"),
  ]);
  if (cats.error || prods.error || links.error) throw new Error("No se pudo cargar el catálogo.");
  const planillasPorProducto = new Map<string, string[]>();
  for (const link of links.data as unknown as { producto_id: string; planillas_inventario: { codigo: string } | null }[]) {
    const codigo = link.planillas_inventario?.codigo;
    if (!codigo) continue;
    planillasPorProducto.set(link.producto_id, [...(planillasPorProducto.get(link.producto_id) ?? []), codigo]);
  }
  const productos: AdminProducto[] = (prods.data as unknown as (Producto & { categorias: { nombre: string } | null })[]).map(p => ({
    ...p,
    categoria_nombre: p.categorias?.nombre ?? "Sin categoría",
    planillas: [...new Set(planillasPorProducto.get(p.id) ?? [])].sort(),
  }));
  return { categorias: cats.data as Categoria[], productos };
}
