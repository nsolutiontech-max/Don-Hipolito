"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  confirmarConversion, corregirCompraIncompleta, quitarConversion, registrarCompra,
} from "@/app/admin/compras/actions";
import type {
  CompraAdmin, CompraIncompleta, ConversionCompra, ProductoCompra,
} from "@/lib/compras-admin";
import type { Proveedor } from "@/lib/types";

type UnidadCompra = "KG" | "UN" | "LT" | "PAQ" | "ATADO" | "CAJA";
type Resultado = { ok: boolean; error?: string };
const UNIDADES: UnidadCompra[] = ["KG", "UN", "LT", "PAQ", "ATADO", "CAJA"];
const hoy = () => new Date().toISOString().slice(0, 10);

const numero = (valor: FormDataEntryValue | null) => Number(String(valor ?? "").replace(",", "."));
const formatearFecha = (fecha: string) => new Date(fecha).toLocaleDateString("es-AR");
const importe = (valor: number) => `$${valor.toLocaleString("es-AR")}`;

export function ComprasAdmin({ proveedores, productos, compras, incompletas, esDueno }: {
  proveedores: Proveedor[];
  productos: ProductoCompra[];
  compras: CompraAdmin[];
  incompletas: CompraIncompleta[];
  esDueno: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [productoId, setProductoId] = useState("");
  const [unidadOperada, setUnidadOperada] = useState<UnidadCompra | null>(null);
  const [conversionProducto, setConversionProducto] = useState("");

  const producto = productos.find(fila => fila.id === productoId);
  const productoConversion = productos.find(fila => fila.id === conversionProducto);
  const unidadInicial: UnidadCompra = producto && producto.unidad_medida !== "POR_DEFINIR"
    ? producto.unidad_medida as UnidadCompra : "KG";
  const unidadElegida = unidadOperada ?? unidadInicial;
  const conversionElegida: ConversionCompra | null = producto
    && producto.unidad_medida !== "POR_DEFINIR" && unidadElegida !== producto.unidad_medida
    ? producto.conversiones.find(fila => fila.unidad === unidadElegida) ?? null : null;

  const operar = async (accion: () => Promise<Resultado>, textoOk: string) => {
    setSaving(true); setMessage(""); setError("");
    try {
      const resultado = await accion();
      if (!resultado.ok) { setError(resultado.error ?? "Operación fallida."); return; }
      setMessage(textoOk);
      router.refresh();
    } catch { setError("No se pudo conectar. Volvé a intentar."); }
    finally { setSaving(false); }
  };

  return <div className="space-y-4">
    <section className="panel">
      <h2>Registrar compra</h2>
      <form className="mt-3 grid gap-3 sm:grid-cols-2" action={form => {
        const cantidad = numero(form.get("cantidad"));
        const precio = numero(form.get("precio"));
        if (!productoId || !form.get("proveedor") || !Number.isFinite(cantidad) || cantidad <= 0
          || !Number.isFinite(precio) || precio < 0) {
          setError("Completá producto, proveedor, una cantidad mayor que cero y un precio válido.");
          return;
        }
        void operar(() => registrarCompra({
          productoId,
          proveedorId: String(form.get("proveedor")),
          cantidad, unidadMedida: unidadElegida, precioUnitario: precio,
          fecha: String(form.get("fecha") ?? "") || undefined,
        }), "Compra registrada con su movimiento de ingreso.");
      }}>
        <label><span className="mb-1 block text-xs font-medium text-zinc-600">Producto</span>
          <select className="field" name="producto" required value={productoId}
            onChange={event => { setProductoId(event.target.value); setUnidadOperada(null); setMessage(""); }}>
            <option value="" disabled>Elegí un producto…</option>
            {productos.map(fila => <option key={fila.id} value={fila.id}>{fila.nombre} · {fila.categoria_nombre}</option>)}
          </select></label>
        <label><span className="mb-1 block text-xs font-medium text-zinc-600">Proveedor</span>
          <select className="field" name="proveedor" required defaultValue="">
            <option value="" disabled>Elegí un proveedor…</option>
            {proveedores.map(proveedor => <option key={proveedor.id} value={proveedor.id}>{proveedor.nombre}</option>)}
          </select></label>
        <label><span className="mb-1 block text-xs font-medium text-zinc-600">Cantidad</span>
          <input className="field text-center tabular-nums" name="cantidad" inputMode="decimal" placeholder="Ej.: 12,5" required /></label>
        <label><span className="mb-1 block text-xs font-medium text-zinc-600">Precio unitario</span>
          <input className="field text-center tabular-nums" name="precio" inputMode="decimal" placeholder="Ej.: 1500,50" required /></label>
        <label><span className="mb-1 block text-xs font-medium text-zinc-600">Unidad de compra (ARS)</span>
          <select className="field" name="unidad" value={unidadElegida} required
            onChange={event => { setUnidadOperada(event.target.value as UnidadCompra); setMessage(""); }}>
            {UNIDADES.map(unidad => <option key={unidad} value={unidad}>{unidad}</option>)}
          </select></label>
        <label><span className="mb-1 block text-xs font-medium text-zinc-600">Fecha</span>
          <input className="field" type="date" name="fecha" defaultValue={hoy()} required /></label>
        {producto && unidadElegida !== producto.unidad_medida && (
          producto.unidad_medida === "POR_DEFINIR"
            ? <p className="sm:col-span-2 text-xs text-amber-800">El producto no tiene unidad base definida: la compra queda como dato incompleto para revisión del dueño.</p>
            : conversionElegida
              ? <p className="sm:col-span-2 text-xs text-emerald-800">Conversión confirmada: 1 {unidadElegida} = {Number(conversionElegida.factor_a_base)} {producto.unidad_medida}; la base cuenta {Number(conversionElegida.factor_a_base)} {producto.unidad_medida} por unidad comprada.</p>
              : <p className="sm:col-span-2 text-xs text-amber-800">Sin conversión confirmada para {unidadElegida}: la compra queda como dato incompleto hasta que el dueño registre el factor.</p>
        )}
        <button className="button-primary sm:col-span-2" disabled={saving}>{saving ? "Registrando…" : "Registrar compra"}</button>
      </form>
      {!proveedores.length && <p className="mt-3 text-sm text-amber-800">Cargá al menos un proveedor activo en <a className="underline" href="/admin/proveedores">Proveedores</a>.</p>}
    </section>
    {(message || error) && <p className={`panel text-sm ${error ? "text-red-700" : "text-emerald-800"}`} role="status">{error || message}</p>}
    {incompletas.length > 0 && <section className="panel">
      <h2>Datos por corregir ({incompletas.length})</h2>
      <p className="mt-1 text-sm text-zinc-600">Compras sin factor de conversión confirmado. No cuentan en rankings ni costos hasta que el dueño registre el factor; nada se completa automáticamente.</p>
      <ul className="mt-3 space-y-3 text-sm">
        {incompletas.map(row => <li key={row.id}>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="font-semibold">{row.producto_nombre}</p>
            <span className="text-zinc-600">{row.proveedor_nombre ?? "Sin proveedor"}</span>
            <span className="ml-auto text-xs text-zinc-600">{formatearFecha(row.fecha)}</span>
          </div>
          <p className="mt-1 text-zinc-700">
            <span className="tabular-nums">{Number(row.cantidad)} {row.unidad_medida}</span>
            {" · "}precio unitario <span className="tabular-nums">{importe(Number(row.precio_unitario))}</span>
          </p>
          {esDueno ? <form className="mt-2 flex flex-wrap items-end gap-2" action={form => {
            const factor = numero(form.get("factor"));
            if (!Number.isFinite(factor) || factor <= 0) {
              setError("El factor debe ser mayor que cero."); return;
            }
            void operar(() => corregirCompraIncompleta({ compraId: row.id, factor }),
              `Factor registrado: 1 ${row.unidad_medida} = ${factor} base.`);
          }}>
            <label><span className="mb-1 block text-xs font-medium text-zinc-600">
              Factor hacia la base {row.producto_unidad === "POR_DEFINIR" ? "(sin escala aún)" : `(${row.producto_unidad})`}
            </span>
              <input className="field w-32 text-center tabular-nums" name="factor" inputMode="decimal" placeholder="Ej.: 24" required /></label>
            <button className="button-secondary" disabled={saving}>{saving ? "Guardando…" : "Confirmar factor"}</button>
          </form> : <p className="mt-1 text-xs text-amber-800">El dueño debe confirmar el factor de esta compra.</p>}
        </li>)}
      </ul>
    </section>}
    {esDueno && <section className="panel">
      <h2>Conversiones de unidades</h2>
      <p className="mt-1 text-sm text-zinc-600">Cuántas unidades base trae cada unidad de compra (ej.: 1 caja = 24 un). Cambiar un factor no reescribe las compras anteriores: cada compra guarda su propio factor.</p>
      <label className="mt-3 block"><span className="mb-1 block text-xs font-medium text-zinc-600">Producto</span>
        <select className="field" value={conversionProducto}
          onChange={event => { setConversionProducto(event.target.value); setMessage(""); }}>
          <option value="" disabled>Elegí un producto…</option>
          {productos.map(fila => <option key={fila.id} value={fila.id}>{fila.nombre} · {fila.categoria_nombre}</option>)}
        </select></label>
      {productoConversion && (productoConversion.unidad_medida === "POR_DEFINIR"
        ? <p className="mt-2 text-sm text-amber-800">Todavía no tiene unidad base: primero definila desde el catálogo.</p>
        : <div className="mt-3">
          <ul className="space-y-2">
            {productoConversion.conversiones.map(conversion => <li key={conversion.unidad}
              className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 py-2 first:border-0 first:pt-0">
              <span className="font-medium tabular-nums">1 {conversion.unidad} = {Number(conversion.factor_a_base)} {productoConversion.unidad_medida}</span>
              <button type="button" className="text-xs text-red-800 underline" disabled={saving}
                onClick={() => void operar(() => quitarConversion({ productoId: productoConversion.id, unidad: conversion.unidad as UnidadCompra }), "Conversión eliminada.")}>
                Quitar</button>
            </li>)}
          </ul>
          {!productoConversion.conversiones.length && <p className="text-sm text-zinc-600">Sin conversiones confirmadas.</p>}
          <form className="mt-2 flex flex-wrap items-end gap-2" action={form => {
            const unidad = String(form.get("unidad") ?? "") as UnidadCompra;
            const factor = numero(form.get("factor"));
            if (!UNIDADES.includes(unidad) || !Number.isFinite(factor) || factor <= 0) {
              setError("Elegí una unidad y un factor mayor que cero."); return;
            }
            void operar(() => confirmarConversion({ productoId: productoConversion.id, unidad, factor }),
              `Conversión confirmada: 1 ${unidad} = ${factor} ${productoConversion.unidad_medida}.`);
          }}>
            <label><span className="mb-1 block text-xs font-medium text-zinc-600">Unidad de compra</span>
              <select className="field" name="unidad" defaultValue="">
                <option value="" disabled>Elegí…</option>
                {UNIDADES.filter(unidad => unidad !== productoConversion.unidad_medida
                  && !productoConversion.conversiones.some(fila => fila.unidad === unidad))
                  .map(unidad => <option key={unidad} value={unidad}>{unidad}</option>)}
              </select></label>
            <label><span className="mb-1 block text-xs font-medium text-zinc-600">Unidades base por unidad de compra</span>
              <input className="field w-32 text-center tabular-nums" name="factor" inputMode="decimal" placeholder="Ej.: 24" required /></label>
            <button className="button-primary" disabled={saving}>{saving ? "Guardando…" : "Confirmar conversión"}</button>
          </form>
        </div>)}
    </section>}
    <section className="space-y-3">
      <h2>Compras recientes ({compras.length})</h2>
      {!compras.length && <p className="panel text-sm text-zinc-600">Todavía no hay compras registradas.</p>}
      {compras.map(compra => <article className="panel" key={compra.id}>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="font-semibold">{compra.producto_nombre}</p>
          <span className="text-sm text-zinc-600">{compra.proveedor_nombre ?? "Sin proveedor"}</span>
          <span className="ml-auto text-xs text-zinc-600">{formatearFecha(compra.fecha)}</span>
        </div>
        <p className="mt-2 text-sm text-zinc-700">
          <span className="font-semibold tabular-nums">{Number(compra.cantidad)} {compra.unidad_medida}</span>
          {" · "}precio unitario <span className="tabular-nums">{importe(Number(compra.precio_unitario))}</span>
          {" · "}total <span className="font-semibold tabular-nums">{importe(Number(compra.cantidad) * Number(compra.precio_unitario))}</span>
        </p>
        <p className="mt-1 text-xs text-zinc-600">
          {compra.factor_a_base
            ? `Base: ${Number(compra.cantidad_base)} unidades (factor ${Number(compra.factor_a_base)})`
            : "Dato incompleto: sin factor de conversión; pendiente de revisión del dueño."}
        </p>
      </article>)}
    </section>
  </div>;
}
