"use client";

import { StockInput } from "@/components/conteo/StockInput";
import type { DetalleConteo, Producto } from "@/lib/data";

type Props = {
  producto: Producto;
  detalle: DetalleConteo;
  onStock: (productoId: string, valor: number | null) => void;
  onPedido: (productoId: string, valor: number | null) => void;
};

export function ProductRow({ producto, detalle, onStock, onPedido }: Props) {
  return (
    <div className="flex items-end gap-2 border-b border-zinc-100 py-2 last:border-0">
      <div className="min-w-0 flex-[1.2]">
        <p className="truncate text-sm font-medium text-zinc-900">{producto.nombre}</p>
        <p className="text-xs text-zinc-500">
          {producto.unidad_medida} · ideal {producto.stock_ideal}
          {detalle.es_ajuste_manual && (
            <span className="ml-1 rounded bg-sky-100 px-1 text-sky-800">manual</span>
          )}
        </p>
      </div>
      <StockInput
        label="Stock"
        value={detalle.stock_real}
        onChange={(v) => onStock(producto.id, v)}
      />
      <StockInput
        label="Pedir"
        value={detalle.cantidad_pedida ?? detalle.cantidad_sugerida}
        sugerido={detalle.stock_real === null ? null : detalle.cantidad_sugerida}
        onChange={(v) => onPedido(producto.id, v)}
      />
    </div>
  );
}
