"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registrarCompra } from "@/app/admin/compras/actions";
import type { CompraAdmin, ProductoCompra } from "@/lib/compras-admin";
import type { Proveedor } from "@/lib/types";

type UnidadCompra = "KG" | "UN" | "LT" | "PAQ" | "ATADO" | "CAJA";
const UNIDADES: UnidadCompra[] = ["KG", "UN", "LT", "PAQ", "ATADO", "CAJA"];
const hoy = () => new Date().toISOString().slice(0, 10);

const numero = (valor: FormDataEntryValue | null) => Number(String(valor ?? "").replace(",", "."));
const formatearFecha = (fecha: string) => new Date(fecha).toLocaleDateString("es-AR");

export function ComprasAdmin({ proveedores, productos, compras }: {
  proveedores: Proveedor[]; productos: ProductoCompra[]; compras: CompraAdmin[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [productoId, setProductoId] = useState("");

  const producto = productos.find(fila => fila.id === productoId);
  const unidadInicial: UnidadCompra = producto && producto.unidad_medida !== "POR_DEFINIR"
    ? producto.unidad_medida as UnidadCompra : "KG";

  const registrar = async (input: Parameters<typeof registrarCompra>[0]) => {
    setSaving(true); setMessage(""); setError("");
    try {
      const resultado = await registrarCompra(input);
      if (!resultado.ok) { setError(resultado.error ?? "Operación fallida."); return; }
      setMessage("Compra registrada con su movimiento de ingreso.");
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
        void registrar({
          productoId,
          proveedorId: String(form.get("proveedor")),
          cantidad, unidadMedida: String(form.get("unidad")) as UnidadCompra, precioUnitario: precio,
          fecha: String(form.get("fecha") ?? "") || undefined,
        });
      }}>
        <label><span className="mb-1 block text-xs font-medium text-zinc-600">Producto</span>
          <select className="field" name="producto" required value={productoId}
            onChange={event => setProductoId(event.target.value)}>
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
        <label><span className="mb-1 block text-xs font-medium text-zinc-600">Unidad</span>
          <select className="field" name="unidad" key={productoId || "sin-producto"} defaultValue={unidadInicial}>
            {UNIDADES.map(unidad => <option key={unidad} value={unidad}>{unidad}</option>)}
          </select></label>
        <label><span className="mb-1 block text-xs font-medium text-zinc-600">Precio unitario</span>
          <input className="field text-center tabular-nums" name="precio" inputMode="decimal" placeholder="Ej.: 1500,50" required /></label>
        <label><span className="mb-1 block text-xs font-medium text-zinc-600">Fecha</span>
          <input className="field" type="date" name="fecha" defaultValue={hoy()} required /></label>
        <button className="button-primary sm:col-span-2" disabled={saving}>{saving ? "Registrando…" : "Registrar compra"}</button>
      </form>
      {!proveedores.length && <p className="mt-3 text-sm text-amber-800">Cargá al menos un proveedor activo en <a className="underline" href="/admin/proveedores">Proveedores</a>.</p>}
    </section>
    {(message || error) && <p className={`panel text-sm ${error ? "text-red-700" : "text-emerald-800"}`} role="status">{error || message}</p>}
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
          {" · "}precio unitario <span className="tabular-nums">${Number(compra.precio_unitario).toLocaleString("es-AR")}</span>
          {" · "}total <span className="font-semibold tabular-nums">${(Number(compra.cantidad) * Number(compra.precio_unitario)).toLocaleString("es-AR")}</span>
        </p>
      </article>)}
    </section>
  </div>;
}
