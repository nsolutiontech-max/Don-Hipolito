"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { exigirOperador } from "@/lib/data";
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

type ActionResult = { ok: boolean; error?: string };

function mensajeDeError(error: { message?: string }): string {
  if (error.message?.includes("Provider not found")) return "El proveedor no existe o está inactivo.";
  if (error.message?.includes("Product not found")) return "El producto no existe o está inactivo.";
  if (error.message?.includes("Invalid quantity")) return "La cantidad debe ser mayor que cero.";
  if (error.message?.includes("Invalid price")) return "El precio no puede ser negativo.";
  return "No se pudo registrar la compra.";
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
