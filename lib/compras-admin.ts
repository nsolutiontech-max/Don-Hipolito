import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import type { Compra, Producto, Proveedor } from "@/lib/types";

export type CompraAdmin = Compra & { producto_nombre: string; proveedor_nombre: string | null };
export type ProductoCompra = Pick<Producto, "id" | "nombre" | "unidad_medida"> & { categoria_nombre: string };

export async function getProveedoresAdmin(): Promise<Proveedor[]> {
  const db = await supabaseServer();
  const { data, error } = await db.from("proveedores").select("id,nombre,telefono,activo").order("nombre");
  if (error) throw new Error("No se pudieron cargar los proveedores.");
  return data;
}

export async function getComprasAdmin(limit = 30): Promise<CompraAdmin[]> {
  const db = await supabaseServer();
  const { data, error } = await db.from("compras")
    .select("id,producto_id,proveedor_id,fecha,cantidad,unidad_medida,precio_unitario,responsable_id,movimiento_id,productos(nombre),proveedores(nombre)")
    .order("fecha", { ascending: false }).limit(limit);
  if (error) throw new Error("No se pudieron cargar las compras.");
  return (data as unknown as (Compra & {
    productos: { nombre: string } | null; proveedores: { nombre: string } | null;
  })[]).map(compra => ({
    id: compra.id, producto_id: compra.producto_id, proveedor_id: compra.proveedor_id,
    fecha: compra.fecha, cantidad: compra.cantidad, unidad_medida: compra.unidad_medida,
    precio_unitario: compra.precio_unitario, responsable_id: compra.responsable_id,
    movimiento_id: compra.movimiento_id,
    producto_nombre: compra.productos?.nombre ?? "Producto",
    proveedor_nombre: compra.proveedores?.nombre ?? null,
  }));
}

export async function getProductosCompra(): Promise<ProductoCompra[]> {
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
