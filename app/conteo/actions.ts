"use server";

import {
  exigirSesion,
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
  await exigirSesion();
  return getDetalles(fecha, turno);
}

export async function guardarConteo(
  fecha: string,
  turno: Turno,
  detalles: DetalleConteo[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    // El responsable siempre sale de la sesión, nunca del cliente.
    const sesion = await exigirSesion();
    const inventarioId = await getOrCreateInventario(fecha, turno, sesion.responsable_id);
    await guardarDetalles(inventarioId, detalles);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error desconocido" };
  }
}
