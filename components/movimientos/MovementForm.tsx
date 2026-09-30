"use client";

import { useState } from "react";
import { registrarMovimiento } from "@/app/movimientos/actions";
import { parsearCantidad } from "@/lib/quantity-parse";
import type { Catalogo, Movimiento } from "@/lib/data";

type Props = {
  catalogo: Catalogo;
  recientesServidor: Movimiento[];
  responsableNombre: string;
};

export function MovementForm({ catalogo, recientesServidor, responsableNombre }: Props) {
  const [productoId, setProductoId] = useState("");
  const [tipo, setTipo] = useState<"INGRESO" | "EGRESO">("INGRESO");
  const [cantidadTxt, setCantidadTxt] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const nombreProducto = (id: string) =>
    catalogo.productos.find((p) => p.id === id)?.nombre ?? id;
  const nombreResponsable = (id: string | null) =>
    catalogo.responsables.find((r) => r.id === id)?.nombre ?? "—";

  const onGuardar = async () => {
    const cantidad = parsearCantidad(cantidadTxt);
    if (!productoId) return setAviso("Elegí un producto.");
    if (cantidad === null || cantidad <= 0) return setAviso("Cantidad inválida.");
    if (!motivo.trim()) return setAviso("Indicá el motivo.");
    setGuardando(true);
    setAviso(null);
    const r = await registrarMovimiento({
      producto_id: productoId,
      tipo,
      cantidad,
      motivo,
    });
    setAviso(r.ok ? "Movimiento guardado ✓" : `Error: ${r.error}`);
    if (r.ok) {
      setProductoId("");
      setCantidadTxt("");
      setMotivo("");
    }
    setGuardando(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <p className="mb-3 text-sm">
          Responsable: <span className="font-semibold text-zinc-900">{responsableNombre}</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(["INGRESO", "EGRESO"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`h-11 rounded-lg text-sm font-semibold ${
                tipo === t
                  ? t === "INGRESO"
                    ? "bg-emerald-700 text-white"
                    : "bg-red-700 text-white"
                  : "bg-zinc-100 text-zinc-700"
              }`}
            >
              {t === "INGRESO" ? "Ingreso" : "Egreso / Merma"}
            </button>
          ))}
        </div>
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500">Producto</span>
          <select
            value={productoId}
            onChange={(e) => setProductoId(e.target.value)}
            className="h-12 rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900"
          >
            <option value="" disabled>Elegir producto…</option>
            {catalogo.categorias.map((c) => (
              <optgroup key={c.id} label={c.nombre}>
                {catalogo.productos
                  .filter((p) => p.categoria_id === c.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} ({p.unidad_medida})
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500">Cantidad</span>
          <input
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={cantidadTxt}
            onChange={(e) => setCantidadTxt(e.target.value)}
            className="h-12 rounded-lg border border-zinc-300 px-3 text-center text-lg font-semibold text-zinc-900 tabular-nums placeholder:text-zinc-400"
          />
        </label>
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500">
            Motivo {tipo === "INGRESO" ? "(proveedor)" : "(merma, rotura, etc.)"}
          </span>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={tipo === "INGRESO" ? "Ej: Proveedor Don Hugo" : "Ej: Merma cocina"}
            className="h-12 rounded-lg border border-zinc-300 px-3 text-base text-zinc-900 placeholder:text-zinc-400"
          />
        </label>
        {aviso && <p className="mt-3 rounded-lg bg-zinc-100 px-3 py-2 text-sm">{aviso}</p>}
        <button
          type="button"
          onClick={onGuardar}
          disabled={guardando}
          className="mt-3 h-12 w-full rounded-lg bg-emerald-700 font-semibold text-white disabled:opacity-40"
        >
          {guardando ? "Guardando…" : "Registrar movimiento"}
        </button>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="font-semibold">Últimos movimientos</h2>
        {recientesServidor.length === 0 && (
          <p className="mt-2 text-sm text-zinc-500">Todavía no hay movimientos.</p>
        )}
        <ul className="mt-2 divide-y divide-zinc-100">
          {recientesServidor.map((m) => (
            <li key={m.id} className="flex items-center gap-2 py-2 text-sm">
              <span
                className={`rounded px-1.5 py-0.5 text-xs font-bold ${
                  m.tipo === "INGRESO" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                }`}
              >
                {m.tipo === "INGRESO" ? "+entrada" : "−salida"}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {nombreProducto(m.producto_id)} · {m.cantidad} · {m.motivo}
              </span>
              <span className="shrink-0 text-xs text-zinc-500">{nombreResponsable(m.responsable_id)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
