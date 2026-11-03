import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import type { Compra, Producto, Proveedor } from "@/lib/types";

export type CompraAdmin = Compra & { producto_nombre: string; proveedor_nombre: string | null };
export type ConversionCompra = { unidad: string; factor_a_base: number };
export type ProductoCompra = Pick<Producto, "id" | "nombre" | "unidad_medida"> & {
  categoria_nombre: string;
  conversiones: ConversionCompra[];
};
export type CompraIncompleta = {
  id: string; fecha: string; cantidad: number; unidad_medida: string; precio_unitario: number;
  producto_nombre: string; producto_unidad: string; proveedor_nombre: string | null;
};

export async function getProveedoresAdmin(): Promise<Proveedor[]> {
  const db = await supabaseServer();
  const { data, error } = await db.from("proveedores").select("id,nombre,telefono,activo").order("nombre");
  if (error) throw new Error("No se pudieron cargar los proveedores.");
  return data;
}

export async function getComprasAdmin(limit = 30): Promise<CompraAdmin[]> {
  const db = await supabaseServer();
  const { data, error } = await db.from("compras")
    .select("id,producto_id,proveedor_id,fecha,cantidad,unidad_medida,precio_unitario,moneda,factor_a_base,cantidad_base,responsable_id,movimiento_id,productos(nombre),proveedores(nombre)")
    .order("fecha", { ascending: false }).limit(limit);
  if (error) throw new Error("No se pudieron cargar las compras.");
  return (data as unknown as (Compra & {
    productos: { nombre: string } | null; proveedores: { nombre: string } | null;
  })[]).map(compra => ({
    id: compra.id, producto_id: compra.producto_id, proveedor_id: compra.proveedor_id,
    fecha: compra.fecha, cantidad: compra.cantidad, unidad_medida: compra.unidad_medida,
    precio_unitario: compra.precio_unitario, responsable_id: compra.responsable_id,
    movimiento_id: compra.movimiento_id,
    moneda: compra.moneda, factor_a_base: compra.factor_a_base, cantidad_base: compra.cantidad_base,
    producto_nombre: compra.productos?.nombre ?? "Producto",
    proveedor_nombre: compra.proveedores?.nombre ?? null,
  }));
}

export async function getComprasIncompletas(limit = 50): Promise<CompraIncompleta[]> {
  const db = await supabaseServer();
  const { data, error } = await db.from("compras")
    .select("id,fecha,cantidad,unidad_medida,precio_unitario,productos(nombre,unidad_medida),proveedores(nombre)")
    .is("factor_a_base", null).order("fecha", { ascending: false }).limit(limit);
  if (error) throw new Error("No se pudieron cargar las compras incompletas.");
  return (data as unknown as {
    id: string; fecha: string; cantidad: number; unidad_medida: string; precio_unitario: number;
    productos: { nombre: string; unidad_medida: string } | null;
    proveedores: { nombre: string } | null;
  }[]).map(compra => ({
    id: compra.id, fecha: compra.fecha, cantidad: compra.cantidad,
    unidad_medida: compra.unidad_medida, precio_unitario: compra.precio_unitario,
    producto_nombre: compra.productos?.nombre ?? "Producto",
    producto_unidad: compra.productos?.unidad_medida ?? "POR_DEFINIR",
    proveedor_nombre: compra.proveedores?.nombre ?? null,
  }));
}

export async function getProductosCompra(): Promise<ProductoCompra[]> {
  const db = await supabaseServer();
  const [productos, conversiones] = await Promise.all([
    db.from("productos").select("id,nombre,unidad_medida,categorias(nombre)")
      .eq("activo", true).order("nombre"),
    db.from("producto_unidades_compra").select("producto_id,unidad,factor_a_base").order("unidad"),
  ]);
  if (productos.error) throw new Error("No se pudieron cargar los productos.");
  if (conversiones.error) throw new Error("No se pudieron cargar las conversiones.");
  const conversionesPorProducto = new Map<string, ConversionCompra[]>();
  for (const fila of conversiones.data as { producto_id: string; unidad: string; factor_a_base: number }[]) {
    const lista = conversionesPorProducto.get(fila.producto_id) ?? [];
    lista.push({ unidad: fila.unidad, factor_a_base: Number(fila.factor_a_base) });
    conversionesPorProducto.set(fila.producto_id, lista);
  }
  return (productos.data as unknown as (Pick<Producto, "id" | "nombre" | "unidad_medida"> & {
    categorias: { nombre: string } | null;
  })[]).map(producto => ({
    id: producto.id, nombre: producto.nombre, unidad_medida: producto.unidad_medida,
    categoria_nombre: producto.categorias?.nombre ?? "Sin categoría",
    conversiones: conversionesPorProducto.get(producto.id) ?? [],
  }));
}
