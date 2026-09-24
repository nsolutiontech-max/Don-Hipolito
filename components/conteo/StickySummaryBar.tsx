"use client";

type Props = {
  contados: number;
  total: number;
  guardando: boolean;
  puedeGuardar: boolean;
  onGuardar: () => void;
  onGenerarPedido: () => void;
};

export function StickySummaryBar({
  contados,
  total,
  guardando,
  puedeGuardar,
  onGuardar,
  onGenerarPedido,
}: Props) {
  return (
    <div className="sticky bottom-0 -mx-4 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur">
      <p className="mb-2 text-center text-sm text-zinc-600 tabular-nums">
        Contados <span className="font-bold text-zinc-900">{contados}</span> de {total}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onGuardar}
          disabled={!puedeGuardar || guardando}
          className="h-12 flex-1 rounded-lg bg-emerald-700 font-semibold text-white disabled:opacity-40"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={onGenerarPedido}
          disabled={contados === 0}
          className="h-12 flex-1 rounded-lg border-2 border-emerald-700 font-semibold text-emerald-800 disabled:opacity-40"
        >
          Generar pedido
        </button>
      </div>
    </div>
  );
}
