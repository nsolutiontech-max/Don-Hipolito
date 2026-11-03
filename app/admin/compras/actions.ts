"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { exigirDueno, exigirOperador } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase/server";

const unidadesCompra = ["KG", "UN", "LT", "PAQ", "ATADO", "CAJA"] as const;
const compraPayload = z.object({
  productoId: z.uuid(),
  proveedorId: z.uuid(),
  cantidad: z.number().positive().max(100000),
  unidadMedida: z.enum(unidadesCompra),
  precioUnitario: z.number().min(0).max(100000000),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
const conversionPayload = z.object({
  productoId: z.uuid(),
  unidad: z.enum(unidadesCompra),
  factor: z.number().positive().max(1000000),
});
const quitarPayload = z.object({
  productoId: z.uuid(),
  unidad: z.enum(unidadesCompra),
});
const correccionPayload = z.object({
  compraId: z.uuid(),
  factor: z.number().positive().max(1000000),
});

type ActionResult = { ok: boolean; error?: string };

function mensajeDeError(error: { message?: string }): string {
  if (error.message?.includes("Provider not found")) return "El proveedor no existe o está inactivo.";
  if (error.message?.includes("Product not found")) return "El producto no existe o está inactivo.";
  if (error.message?.includes("Invalid quantity")) return "La cantidad debe ser mayor que cero.";
  if (error.message?.includes("Invalid price")) return "El precio no puede ser negativo.";
  if (error.message?.includes("Invalid unit")) return "La unidad de compra no es válida.";
  if (error.message?.includes("Invalid factor")) return "El factor debe ser mayor que cero.";
  if (error.message?.includes("must differ")) return "Esa unidad ya es la unidad base del producto: no necesita conversión.";
  if (error.message?.includes("no base unit")) return "Primero definí la unidad base del producto en el catálogo.";
  if (error.message?.includes("Conversion not found")) return "Esa conversión ya no existe.";
  if (error.message?.includes("Purchase not found")) return "La compra no existe o ya fue corregida.";
  return "No se pudo registrar la operación.";
}

export async function registrarCompra(input: z.input<typeof compraPayload>): Promise<ActionResult> {
  try {
    await exigirOperador();
    const parsed = compraPayload.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Revisá producto, proveedor, cantidad, unidad y precio." };
    const db = await supabaseServer();
    const { error } = await db.rpc("registrar_compra", {
      p_producto: parsed.data.productoId,
      p_proveedor: parsed.data.proveedorId,
      p_cantidad: parsed.data.cantidad,
      p_unidad: parsed.data.unidadMedida,
      p_precio: parsed.data.precioUnitario,
      p_fecha: parsed.data.fecha ? `${parsed.data.fecha}T12:00:00` : null,
    });
    if (error) return { ok: false, error: mensajeDeError(error) };
    revalidatePath("/admin/compras");
    revalidatePath("/admin/proveedores");
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo registrar la compra." };
  }
}

export async function confirmarConversion(input: z.input<typeof conversionPayload>): Promise<ActionResult> {
  try {
    await exigirDueno();
    const parsed = conversionPayload.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Revisá la unidad de compra y el factor de conversión." };
    const db = await supabaseServer();
    const { error } = await db.rpc("confirmar_conversion_compra", {
      p_producto: parsed.data.productoId,
      p_unidad: parsed.data.unidad,
      p_factor: parsed.data.factor,
    });
    if (error) return { ok: false, error: mensajeDeError(error) };
    revalidatePath("/admin/compras");
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo confirmar la conversión." };
  }
}

export async function quitarConversion(input: z.input<typeof quitarPayload>): Promise<ActionResult> {
  try {
    await exigirDueno();
    const parsed = quitarPayload.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Revisá la conversión a eliminar." };
    const db = await supabaseServer();
    const { error } = await db.rpc("quitar_conversion_compra", {
      p_producto: parsed.data.productoId,
      p_unidad: parsed.data.unidad,
    });
    if (error) return { ok: false, error: mensajeDeError(error) };
    revalidatePath("/admin/compras");
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo eliminar la conversión." };
  }
}

export async function corregirCompraIncompleta(input: z.input<typeof correccionPayload>): Promise<ActionResult> {
  try {
    await exigirDueno();
    const parsed = correccionPayload.safeParse(input);
    if (!parsed.success) return { ok: false, error: "El factor debe ser mayor que cero." };
    const db = await supabaseServer();
    const { error } = await db.rpc("corregir_compra_incompleta", {
      p_compra: parsed.data.compraId,
      p_factor: parsed.data.factor,
    });
    if (error) return { ok: false, error: mensajeDeError(error) };
    revalidatePath("/admin/compras");
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo corregir la compra." };
  }
}
