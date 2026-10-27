"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { actualizarProducto } from "@/app/admin/catalogo/actions";
import { UNIDADES_MEDIDA } from "@/lib/constants";
import type { AdminProducto } from "@/lib/catalog-admin";
import type { Categoria } from "@/lib/types";

type Edicion = {
  nombre: string; categoria_id: string; unidad_medida: string;
  stock_minimo: string; stock_ideal: string; activo: boolean;
};

const inicio = (p: AdminProducto): Edicion => ({
  nombre: p.nombre, categoria_id: p.categoria_id, unidad_medida: p.unidad_medida,
  stock_minimo: String(p.stock_minimo), stock_ideal: p.stock_ideal === null ? "" : String(p.stock_ideal),
  activo: p.activo,
});

const pendiente = (p: AdminProducto) => p.unidad_medida === "POR_DEFINIR" || p.stock_ideal === null || !p.planillas.length;

export function CatalogAdmin({ categorias, productos }: { categorias: Categoria[]; productos: AdminProducto[] }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [ediciones, setEdiciones] = useState<Record<string, Edicion>>({});
  const [estado, setEstado] = useState<Record<string, { guardando?: boolean; error?: string; ok?: boolean }>>({});
  const cambios = useMemo(() => new Map(Object.entries(ediciones)), [ediciones]);
  const visibles = productos.filter(p => {
    if (soloPendientes && !pendiente(p)) return false;
    const texto = busqueda.trim().toLowerCase();
    return !texto || p.nombre.toLowerCase().includes(texto) || p.categoria_nombre.toLowerCase().includes(texto);
  });
  const pendientesTotales = productos.filter(pendiente).length;

  const editando = (p: AdminProducto) => cambios.get(p.id) ?? inicio(p);
  const patch = (p: AdminProducto, cambio: Partial<Edicion>) => {
    setEdiciones(prev => ({ ...prev, [p.id]: { ...inicio(p), ...prev[p.id], ...cambio } }));
    setEstado(prev => ({ ...prev, [p.id]: {} }));
  };

  const guardar = async (p: AdminProducto) => {
    const actual = cambios.get(p.id);
    if (!actual) return;
    const minimo = Number(actual.stock_minimo);
    const ideal = actual.stock_ideal === "" ? null : Number(actual.stock_ideal);
    if (!actual.nombre.trim() || !Number.isFinite(minimo) || minimo < 0 || (ideal !== null && (!Number.isFinite(ideal) || ideal < 0))) {
      setEstado(prev => ({ ...prev, [p.id]: { error: "Nombre obligatorio y cantidades ≥ 0." } }));
      return;
    }
    setEstado(prev => ({ ...prev, [p.id]: { guardando: true } }));
    const resultado = await actualizarProducto({
      id: p.id, nombre: actual.nombre.trim(), categoria_id: actual.categoria_id,
      unidad_medida: actual.unidad_medida as typeof UNIDADES_MEDIDA[number],
      stock_minimo: minimo, stock_ideal: ideal, activo: actual.activo,
    });
    setEstado(prev => ({ ...prev, [p.id]: resultado.ok ? { ok: true } : { error: resultado.error ?? "Error" } }));
    if (resultado.ok) { setEdiciones(prev => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== p.id))); router.refresh(); }
  };

  return <div className="space-y-4">
    <div className="panel">
      <p className="text-sm text-zinc-700">
        <span className="font-semibold tabular-nums">{productos.length}</span> productos ·{" "}
        <span className="font-semibold tabular-nums">{pendientesTotales}</span> pendientes de configurar.
      </p>
      <p className="mt-2 text-xs text-zinc-600">Al fijar el stock ideal, el objetivo queda confirmado y el conteo empezará a sugerir el pedido.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block"><span className="sr-only">Buscar producto</span>
        <input className="field" placeholder="Buscar por nombre o categoría…" value={busqueda} onChange={event => setBusqueda(event.target.value)} /></label>
      <label className="flex min-h-12 items-center gap-3 text-sm"><input type="checkbox" className="size-5 accent-emerald-700" checked={soloPendientes}
        onChange={event => setSoloPendientes(event.target.checked)} />Mostrar sólo pendientes de configurar</label>
    </div>
    {!visibles.length && <p className="panel">No hay productos que coincidan con el filtro.</p>}
    {visibles.map(p => {
      const edicion = editando(p);
      const sucio = cambios.has(p.id);
      const msg = estado[p.id] ?? {};
      return <article className="panel" key={p.id}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className="mb-1 block text-xs font-medium text-zinc-600">Nombre</span>
            <input className="field" value={edicion.nombre} maxLength={200} onChange={event => patch(p, { nombre: event.target.value })} /></label>
          <label><span className="mb-1 block text-xs font-medium text-zinc-600">Categoría</span>
            <select className="field" value={edicion.categoria_id} onChange={event => patch(p, { categoria_id: event.target.value })}>
              {categorias.map(categoria => <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>)}
            </select></label>
          <label><span className="mb-1 block text-xs font-medium text-zinc-600">Unidad</span>
            <select className="field" value={edicion.unidad_medida} onChange={event => patch(p, { unidad_medida: event.target.value })}>
              {UNIDADES_MEDIDA.map(unidad => <option key={unidad} value={unidad}>{unidad}</option>)}
            </select></label>
          <label><span className="mb-1 block text-xs font-medium text-zinc-600">Stock mínimo</span>
            <input className="field text-center tabular-nums" inputMode="decimal" value={edicion.stock_minimo}
              onChange={event => patch(p, { stock_minimo: event.target.value })} /></label>
          <label><span className="mb-1 block text-xs font-medium text-zinc-600">Stock ideal (vacío = sin definir)</span>
            <input className="field text-center tabular-nums" inputMode="decimal" value={edicion.stock_ideal} placeholder="—"
              onChange={event => patch(p, { stock_ideal: event.target.value })} /></label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${p.objetivo_confirmado ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
            {p.objetivo_confirmado ? "objetivo confirmado" : "objetivo estimado"}</span>
          {p.planillas.length
            ? <span className="text-xs text-zinc-600">Planillas: {p.planillas.join(", ")}</span>
            : <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600">sin planilla</span>}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-5 accent-emerald-700" checked={edicion.activo}
            onChange={event => patch(p, { activo: event.target.checked })} />Activo</label>
          <button type="button" className={`ml-auto min-h-12 rounded-lg px-4 text-sm font-semibold ${sucio ? "bg-emerald-800 text-white" : "border border-zinc-300 text-zinc-500"}`}
            disabled={!sucio || msg.guardando} onClick={() => guardar(p)}>{msg.guardando ? "Guardando…" : "Guardar cambios"}</button>
        </div>
        {(msg.error || msg.ok) && <p className={`mt-2 text-sm ${msg.error ? "text-red-700" : "text-emerald-800"}`} role="status">{msg.error ?? "Producto actualizado."}</p>}
      </article>;
    })}
  </div>;
}
