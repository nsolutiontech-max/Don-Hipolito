"use client";

import { useState } from "react";
import { parsearCantidad } from "@/lib/quantity-parse";

type Props = {
  label: string;
  value: number | null;
  sugerido?: number | null;
  onChange: (valor: number | null) => void;
};

/** Input numérico grande para cocina: acepta "2,5" y "1/2". Guarda al salir. */
export function StockInput({ label, value, sugerido, onChange }: Props) {
  const [texto, setTexto] = useState<string>(value === null ? "" : String(value));
  const [tocado, setTocado] = useState(false);

  const confirmar = () => {
    const n = parsearCantidad(texto);
    onChange(n);
    setTocado(true);
  };

  const invalido = tocado && texto.trim() !== "" && parsearCantidad(texto) === null;

  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-xs font-medium text-zinc-500">
        {label}
        {sugerido !== undefined && sugerido !== null && (
          <span className="ml-1 rounded bg-amber-100 px-1 text-amber-800">
            sug. {sugerido}
          </span>
        )}
      </span>
      <input
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setTocado(false);
        }}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className={`h-12 w-full rounded-lg border px-3 text-center text-lg font-semibold tabular-nums ${
          invalido
            ? "border-red-500 bg-red-50"
            : "border-zinc-300 bg-white focus:border-emerald-600"
        }`}
      />
    </label>
  );
}
