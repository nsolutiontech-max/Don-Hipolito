export type EstadoHistorial = "COMPLETO" | "PARCIAL" | "CERRADO";

type DetalleHistorico = { producto_id: string; stock_real: number | null };

// A product counts as complete once every required location has a real quantity.
// Beverages need both DEPOSITO and HELADERA; stock sheets need a single value.
export function contarArticulosCompletos(detalles: DetalleHistorico[], ubicacionesRequeridas: number): number {
  if (ubicacionesRequeridas < 1) return 0;
  const byProduct = new Map<string, number>();
  for (const detalle of detalles) {
    if (detalle.stock_real === null) continue;
    byProduct.set(detalle.producto_id, (byProduct.get(detalle.producto_id) ?? 0) + 1);
  }
  return [...byProduct.values()].filter(count => count >= ubicacionesRequeridas).length;
}

export function estadoInventario(estado: string, completos: number, total: number): EstadoHistorial {
  if (estado === "CERRADO") return "CERRADO";
  return total > 0 && completos >= total ? "COMPLETO" : "PARCIAL";
}
