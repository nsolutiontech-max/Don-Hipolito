"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  agregarProducto, archivarProducto, archivarSeccion,
  crearSeccion, reordenarProductos, reordenarSecciones,
} from "@/app/admin/planillas/actions";
import type { PlanillaAdmin, ProductoOpcion } from "@/lib/planillas-admin";

type Resultado = { ok: boolean; error?: string };

export function PlanillasAdmin({ planillas, productos }: { planillas: PlanillaAdmin[]; productos: ProductoOpcion[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const ejecutar = async (clave: string, tarea: () => Promise<Resultado>) => {
    setSaving(clave); setMessage(""); setError("");
    try {
      const resultado = await tarea();
      if (!resultado.ok) { setError(resultado.error ?? "Operación fallida."); return; }
      setMessage("Cambios guardados."); router.refresh();
    } catch { setError("No se pudo conectar. Volvé a intentar."); }
    finally { setSaving(""); }
  };

  const mover = <T,>(lista: T[], indice: number, desplazamiento: number): T[] => {
    const destino = indice + desplazamiento;
    if (destino < 0 || destino >= lista.length) return lista;
    const copia = [...lista];
    [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
    return copia;
  };

  return <div className="space-y-5">
    {(message || error) && <p className={`panel text-sm ${error ? "text-red-700" : "text-emerald-800"}`} role="status">{error || message}</p>}
    {planillas.map(planilla => {
      const usados = new Set(planilla.secciones.flatMap(seccion => seccion.items.map(item => item.producto_id)));
      const disponibles = productos.filter(producto => !usados.has(producto.id));
      return <section className="panel space-y-4" key={planilla.id}>
        <header className="flex flex-wrap items-center gap-2">
          <h2>{planilla.nombre}</h2>
          <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">{planilla.codigo}</span>
          <span className="text-xs text-zinc-600">{planilla.modo === "STOCK_PEDIDO" ? "Stock y pedido" : "Stock por ubicación"}</span>
          <span className="ml-auto text-xs text-zinc-600">{planilla.secciones.length} secciones</span>
        </header>
        <div className="space-y-3">
          {planilla.secciones.map((seccion, indiceSeccion) => {
            const clave = `seccion:${seccion.id}`;
            const guardando = saving === clave;
            return <article className="rounded-xl border border-zinc-200 p-3" key={seccion.id}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{seccion.nombre}</p>
                <span className="text-xs text-zinc-600">{seccion.items.length} productos</span>
                <div className="ml-auto flex flex-wrap gap-1">
                  <button type="button" className="button-secondary" aria-label={`Subir ${seccion.nombre}`}
                    disabled={guardando || indiceSeccion === 0}
                    onClick={() => void ejecutar(clave, () => reordenarSecciones({
                      planillaId: planilla.id,
                      ids: mover(planilla.secciones, indiceSeccion, -1).map(item => item.id),
                    }))}>↑</button>
                  <button type="button" className="button-secondary" aria-label={`Bajar ${seccion.nombre}`}
                    disabled={guardando || indiceSeccion === planilla.secciones.length - 1}
                    onClick={() => void ejecutar(clave, () => reordenarSecciones({
                      planillaId: planilla.id,
                      ids: mover(planilla.secciones, indiceSeccion, 1).map(item => item.id),
                    }))}>↓</button>
                  <button type="button" className="button-secondary"
                    disabled={guardando || planilla.secciones.length === 1}
                    onClick={() => void ejecutar(clave, () => archivarSeccion({ seccionId: seccion.id }))}>
                    Quitar sección</button>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {!seccion.items.length && <p className="text-sm text-zinc-600">Sin productos activos en esta sección.</p>}
                {seccion.items.map((item, indiceItem) => {
                  const claveItem = `item:${item.id}`;
                  return <div className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2" key={item.id}>
                    <span className="text-sm font-medium">{item.nombre}</span>
                    {item.presentacion && <span className="text-xs text-zinc-600">{item.presentacion}</span>}
                    <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-zinc-700">{item.unidad_medida}</span>
                    <div className="ml-auto flex flex-wrap gap-1">
                      <button type="button" className="button-secondary" aria-label={`Subir ${item.nombre}`}
                        disabled={saving === claveItem || indiceItem === 0}
                        onClick={() => void ejecutar(claveItem, () => reordenarProductos({
                          planillaId: planilla.id, seccionId: seccion.id,
                          ids: mover(seccion.items, indiceItem, -1).map(fila => fila.id),
                        }))}>↑</button>
                      <button type="button" className="button-secondary" aria-label={`Bajar ${item.nombre}`}
                        disabled={saving === claveItem || indiceItem === seccion.items.length - 1}
                        onClick={() => void ejecutar(claveItem, () => reordenarProductos({
                          planillaId: planilla.id, seccionId: seccion.id,
                          ids: mover(seccion.items, indiceItem, 1).map(fila => fila.id),
                        }))}>↓</button>
                      <button type="button" className="button-secondary" disabled={saving === claveItem}
                        onClick={() => void ejecutar(claveItem, () => archivarProducto({ itemId: item.id }))}>
                        Quitar</button>
                    </div>
                  </div>;
                })}
              </div>
              <form className="mt-3 flex flex-wrap items-end gap-2" action={form => {
                const productoId = String(form.get("producto") ?? "");
                if (!productoId) return;
                void ejecutar(clave, () => agregarProducto({ planillaId: planilla.id, seccionId: seccion.id, productoId }));
              }}>
                <label className="min-w-56 flex-1"><span className="mb-1 block text-xs font-medium text-zinc-600">Agregar producto</span>
                  <select className="field" name="producto" required defaultValue="">
                    <option value="" disabled>Elegí un producto…</option>
                    {disponibles.map(producto => <option key={producto.id} value={producto.id}>
                      {producto.nombre} · {producto.categoria_nombre}
                    </option>)}
                  </select></label>
                <button className="button-secondary" disabled={guardando}>Agregar</button>
              </form>
            </article>;
          })}
        </div>
        <form className="flex flex-wrap items-end gap-2" action={form => {
          const nombre = String(form.get("nombre") ?? "").trim();
          if (!nombre) return;
          void ejecutar(`nueva:${planilla.id}`, () => crearSeccion({ planillaId: planilla.id, nombre }));
        }}>
          <label className="min-w-56 flex-1"><span className="mb-1 block text-xs font-medium text-zinc-600">Nueva sección</span>
            <input className="field" name="nombre" maxLength={80} placeholder="Ej.: Frutos secos" required /></label>
          <button className="button-primary" disabled={saving === `nueva:${planilla.id}`}>Crear sección</button>
        </form>
      </section>;
    })}
  </div>;
}
