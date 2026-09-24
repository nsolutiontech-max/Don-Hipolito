"use server";

import { crearPedido } from "@/lib/data";

export async function guardarPedido(
  fecha: string,
  items: { producto_id: string; cantidad: number }[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (items.length === 0) return { ok: false, error: "No hay items para pedir." };
    await crearPedido(fecha, items);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error desconocido" };
  }
}
