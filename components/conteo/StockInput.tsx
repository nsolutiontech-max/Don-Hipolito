"use client";

import { parsearCantidad } from "@/lib/quantity-parse";
import { useId } from "react";

export function StockInput({ label, value, onChange, disabled = false }: {
  label: string; value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  const invalid = value.trim() !== "" && parsearCantidad(value) === null;
  const errorId = useId();
  return <label className="min-w-0 flex-1">
    <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
    <input inputMode="decimal" autoComplete="off" value={value} placeholder="Sin contar"
      aria-label={label} aria-invalid={invalid} aria-describedby={invalid ? errorId : undefined}
      disabled={disabled} onChange={event => onChange(event.target.value)}
      className={`field text-center text-lg font-semibold tabular-nums ${invalid ? "border-red-600 bg-red-50" : ""}`} />
    {invalid && <span id={errorId} className="text-xs text-red-700">Cantidad no válida</span>}
  </label>;
}
