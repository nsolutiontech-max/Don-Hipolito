"use server";

import { exigirSesion, guardarMovimiento } from "@/lib/data";
import { revalidatePath } from "next/cache";

export async function registrarMovimiento(input: {
  producto_id: string;
  tipo: "INGRESO" | "EGRESO";
  cantidad: number;
  motivo: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    // El responsable siempre sale de la sesión, nunca del cliente.
    const sesion = await exigirSesion();
    if (!input.producto_id) return { ok: false, error: "Elegí un producto." };
    if (!(input.cantidad > 0)) return { ok: false, error: "La cantidad debe ser mayor a 0." };
    if (!input.motivo.trim()) return { ok: false, error: "Indicá el motivo (proveedor, merma, etc.)." };
    await guardarMovimiento({
      ...input,
      motivo: input.motivo.trim(),
      responsable_id: sesion.responsable_id,
    });
    revalidatePath("/movimientos");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error desconocido" };
  }
}
