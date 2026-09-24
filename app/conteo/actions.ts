"use server";

import {
  getDetalles,
  getOrCreateInventario,
  guardarDetalles,
  type DetalleConteo,
  type Turno,
} from "@/lib/data";

export async function cargarDetalles(
  fecha: string,
  turno: Turno,
): Promise<DetalleConteo[]> {
  return getDetalles(fecha, turno);
}

export async function guardarConteo(
  fecha: string,
  turno: Turno,
  responsableId: string | null,
  detalles: DetalleConteo[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    const inventarioId = await getOrCreateInventario(fecha, turno, responsableId);
    await guardarDetalles(inventarioId, detalles);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error desconocido" };
  }
}
