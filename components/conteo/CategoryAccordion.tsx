"use client";

import { useState } from "react";
import { ProductRow } from "@/components/conteo/ProductRow";
import type { Categoria, DetalleConteo, Producto } from "@/lib/data";

type Props = {
  categoria: Categoria;
  productos: Producto[];
  detalles: Map<string, DetalleConteo>;
  abierto: boolean;
  onToggle: () => void;
  onStock: (productoId: string, valor: number | null) => void;
  onPedido: (productoId: string, valor: number | null) => void;
};

export function CategoryAccordion({
  categoria,
  productos,
  detalles,
  abierto,
  onToggle,
  onStock,
  onPedido,
}: Props) {
  const [filtro, setFiltro] = useState("");
  const contados = productos.filter((p) => detalles.get(p.id)?.stock_real !== null).length;
  const visibles = filtro.trim()
    ? productos.filter((p) => p.nombre.toLowerCase().includes(filtro.trim().toLowerCase()))
    : productos;
  const completo = contados === productos.length;

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
        aria-expanded={abierto}
      >
        <span className="flex-1 font-semibold text-zinc-900">{categoria.nombre}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
            completo ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-600"
          }`}
        >
          {contados}/{productos.length}
        </span>
        <span className="text-zinc-400">{abierto ? "▾" : "▸"}</span>
      </button>
      {abierto && (
        <div className="border-t border-zinc-100 px-4 pb-3">
          {productos.length > 8 && (
            <input
              placeholder="Buscar…"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="mt-2 h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
            />
          )}
          {visibles.map((p) => (
            <ProductRow
              key={p.id}
              producto={p}
              detalle={detalles.get(p.id)!}
              onStock={onStock}
              onPedido={onPedido}
            />
          ))}
        </div>
      )}
    </section>
  );
}
