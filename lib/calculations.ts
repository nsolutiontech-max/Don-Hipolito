export function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Pedido sugerido = lo que falta para llegar al stock ideal.
 * Sin conteo (null) devuelve 0: la UI muestra "—" hasta que se cuenta.
 */
export function cantidadSugerida(
  stockIdeal: number,
  stockReal: number | null,
): number {
  if (stockReal === null || Number.isNaN(stockReal)) return 0;
  return redondear2(Math.max(0, stockIdeal - stockReal));
}
