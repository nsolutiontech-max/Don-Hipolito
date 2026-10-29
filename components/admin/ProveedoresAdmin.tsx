"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { actualizarProveedor, crearProveedor } from "@/app/admin/proveedores/actions";
import type { Proveedor } from "@/lib/types";

type Edicion = { nombre: string; telefono: string; activo: boolean };
const inicio = (proveedor: Proveedor): Edicion => ({
  nombre: proveedor.nombre, telefono: proveedor.telefono ?? "", activo: proveedor.activo,
});

export function ProveedoresAdmin({ proveedores }: { proveedores: Proveedor[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [ediciones, setEdiciones] = useState<Record<string, Edicion>>({});
  const [estado, setEstado] = useState<Record<string, { guardando?: boolean; error?: string; ok?: boolean }>>({});

  const ejecutar = async (clave: string, tarea: () => Promise<{ ok: boolean; error?: string }>) => {
    setSaving(clave); setMessage(""); setError("");
    try {
      const resultado = await tarea();
      if (!resultado.ok) { setError(resultado.error ?? "Operación fallida."); return false; }
      setMessage("Cambios guardados."); router.refresh(); return true;
    } catch { setError("No se pudo conectar. Volvé a intentar."); return false; }
    finally { setSaving(""); }
  };

  const editando = (proveedor: Proveedor) => ediciones[proveedor.id] ?? inicio(proveedor);
  const patch = (proveedor: Proveedor, cambio: Partial<Edicion>) => {
    setEdiciones(prev => ({ ...prev, [proveedor.id]: { ...inicio(proveedor), ...prev[proveedor.id], ...cambio } }));
    setEstado(prev => ({ ...prev, [proveedor.id]: {} }));
  };

  const guardar = async (proveedor: Proveedor) => {
    const actual = ediciones[proveedor.id];
    if (!actual) return;
    if (!actual.nombre.trim()) {
      setEstado(prev => ({ ...prev, [proveedor.id]: { error: "El nombre es obligatorio." } }));
      return;
    }
    setEstado(prev => ({ ...prev, [proveedor.id]: { guardando: true } }));
    const resultado = await actualizarProveedor({
      id: proveedor.id, nombre: actual.nombre.trim(), telefono: actual.telefono, activo: actual.activo,
    });
    setEstado(prev => ({ ...prev, [proveedor.id]: resultado.ok ? { ok: true } : { error: resultado.error } }));
    if (resultado.ok) {
      setEdiciones(prev => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== proveedor.id)));
      router.refresh();
    }
  };

  return <div className="space-y-4">
    <section className="panel">
      <h2>Nuevo proveedor</h2>
      <form className="mt-3 grid gap-3 sm:grid-cols-2" action={form => {
        const nombre = String(form.get("nombre") ?? "").trim();
        if (!nombre) return;
        void ejecutar(`nuevo:${nombre}`, () => crearProveedor({ nombre, telefono: String(form.get("telefono") ?? "") }));
      }}>
        <label><span className="mb-1 block text-xs font-medium text-zinc-600">Nombre</span>
          <input className="field" name="nombre" maxLength={120} required /></label>
        <label><span className="mb-1 block text-xs font-medium text-zinc-600">Teléfono (opcional)</span>
          <input className="field" name="telefono" maxLength={60} /></label>
        <button className="button-primary sm:col-span-2" disabled={Boolean(saving)}>Crear proveedor</button>
      </form>
    </section>
    {(message || error) && <p className={`panel text-sm ${error ? "text-red-700" : "text-emerald-800"}`} role="status">{error || message}</p>}
    <section className="space-y-3">
      <h2>Proveedores ({proveedores.length})</h2>
      {!proveedores.length && <p className="panel text-sm text-zinc-600">Todavía no hay proveedores cargados.</p>}
      {proveedores.map(proveedor => {
        const edicion = editando(proveedor);
        const sucio = Boolean(ediciones[proveedor.id]);
        const msg = estado[proveedor.id] ?? {};
        return <article className="panel" key={proveedor.id}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className="mb-1 block text-xs font-medium text-zinc-600">Nombre</span>
              <input className="field" value={edicion.nombre} maxLength={120}
                onChange={event => patch(proveedor, { nombre: event.target.value })} /></label>
            <label><span className="mb-1 block text-xs font-medium text-zinc-600">Teléfono</span>
              <input className="field" value={edicion.telefono} maxLength={60}
                onChange={event => patch(proveedor, { telefono: event.target.value })} /></label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${edicion.activo ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-800"}`}>
              {edicion.activo ? "Activo" : "Inactivo"}</span>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-5 accent-emerald-700"
              checked={edicion.activo} onChange={event => patch(proveedor, { activo: event.target.checked })} />Activo</label>
            <button type="button" className={`ml-auto min-h-12 rounded-lg px-4 text-sm font-semibold ${sucio ? "bg-emerald-800 text-white" : "border border-zinc-300 text-zinc-500"}`}
              disabled={!sucio || msg.guardando} onClick={() => void guardar(proveedor)}>
              {msg.guardando ? "Guardando…" : "Guardar cambios"}</button>
          </div>
          {(msg.error || msg.ok) && <p className={`mt-2 text-sm ${msg.error ? "text-red-700" : "text-emerald-800"}`} role="status">{msg.error ?? "Proveedor actualizado."}</p>}
        </article>;
      })}
    </section>
  </div>;
}
