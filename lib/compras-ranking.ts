import "server-only";
import { supabaseServer } from "@/lib/supabase/server";

export type RankingCompra = {
  producto_id: string;
  producto_nombre: string;
  categoria_nombre: string;
  unidad_base: string;
  gasto_ars: number;
  participacion_pct: number | null;
  cantidad_base: number | null;
  compras: number;
  lineas_completas: number;
  lineas_incompletas: number;
  ultima_compra: string | null;
};

const formatoBA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric", month: "2-digit", day: "2-digit",
});

export const fechaBA = (valor: Date) => formatoBA.format(valor);
export const hoyBA = () => fechaBA(new Date());
export const inicioDeMesBA = () => `${hoyBA().slice(0, 8)}01`;

export async function getRankingCompras(filtros: {
  desde: string; hasta: string; categoria?: string; producto?: string; proveedor?: string;
}): Promise<RankingCompra[]> {
  const db = await supabaseServer();
  const { data, error } = await db.rpc("ranking_compras", {
    p_desde: filtros.desde,
    p_hasta: filtros.hasta,
    p_categoria: filtros.categoria ?? null,
    p_producto: filtros.producto ?? null,
    p_proveedor: filtros.proveedor ?? null,
  });
  if (error) throw new Error("No se pudo cargar el ranking de compras.");
  const filas = (data ?? []) as Array<{
    producto_id: string; producto_nombre: string; categoria_nombre: string; unidad_base: string;
    gasto_ars: number | string; participacion_pct: number | string | null;
    cantidad_base: number | string | null; compras: number | string;
    lineas_completas: number | string; lineas_incompletas: number | string;
    ultima_compra: string | null;
  }>;
  return filas.map(fila => ({
    producto_id: fila.producto_id,
    producto_nombre: fila.producto_nombre,
    categoria_nombre: fila.categoria_nombre,
    unidad_base: fila.unidad_base,
    gasto_ars: Number(fila.gasto_ars),
    participacion_pct: fila.participacion_pct === null ? null : Number(fila.participacion_pct),
    cantidad_base: fila.cantidad_base === null ? null : Number(fila.cantidad_base),
    compras: Number(fila.compras),
    lineas_completas: Number(fila.lineas_completas),
    lineas_incompletas: Number(fila.lineas_incompletas),
    ultima_compra: fila.ultima_compra,
  }));
}
