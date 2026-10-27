"use server";

import { exigirOperador, guardarMovimiento } from "@/lib/data";
import { z } from "zod";
import { revalidatePath } from "next/cache";

export async function registrarMovimiento(input: {
  producto_id: string;
  tipo: "INGRESO" | "EGRESO";
  cantidad: number;
  motivo: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    // El responsable siempre sale de la sesión, nunca del cliente.
    const sesion = await exigirOperador();
    const parsed = z.object({ producto_id: z.uuid(), tipo: z.enum(["INGRESO", "EGRESO"]),
      cantidad: z.number().finite().positive().max(99999999.99), motivo: z.string().trim().min(1).max(1000) }).safeParse(input);
    if (!parsed.success) return { ok: false, error: "Datos del movimiento no válidos." };
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
