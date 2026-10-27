/**
 * Acepta lo que se escribe en cocina: "2", "2.5", "2,5", "1/2", "3 1/2".
 * Devuelve null si está vacío o es inválido. Nunca negativo.
 */
export function parsearCantidad(input: string): number | null {
  const raw = input.trim().replace(",", ".");
  if (raw === "") return null;

  const mixto = raw.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (mixto) {
    const den = parseFloat(mixto[3]);
    if (!den) return null;
    const value = parseFloat(mixto[1]) + parseFloat(mixto[2]) / den;
    return Number.isFinite(value) ? value : null;
  }

  const fraccion = raw.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (fraccion) {
    const den = parseFloat(fraccion[2]);
    if (!den) return null;
    const value = parseFloat(fraccion[1]) / den;
    return Number.isFinite(value) ? value : null;
  }

  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}
