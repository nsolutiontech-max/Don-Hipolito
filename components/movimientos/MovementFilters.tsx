"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Catalogo } from "@/lib/data";

export function MovementFilters({ catalogo }: { catalogo: Catalogo }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const getValue = (key: string) => searchParams.get(key) ?? "";
  const hasFilters = ["desde", "hasta", "producto", "tipo"].some(key => searchParams.has(key));

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const params = new URLSearchParams();
    for (const [key, value] of data.entries()) {
      if (value) params.set(key, String(value));
    }
    router.push(`/movimientos${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const handleClear = () => {
    router.push("/movimientos");
  };

  const currentTipo = getValue("tipo") || "TODOS";
  const currentProducto = getValue("producto");
  const currentDesde = getValue("desde");
  const currentHasta = getValue("hasta");

  return (
    <form onSubmit={handleSubmit} className="panel space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[180px]">
          <label className="block mb-1 text-sm font-medium">Desde</label>
          <input className="field" type="date" name="desde" value={currentDesde} />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block mb-1 text-sm font-medium">Hasta</label>
          <input className="field" type="date" name="hasta" value={currentHasta} max={currentHasta || new Date().toISOString().slice(0, 10)} />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block mb-1 text-sm font-medium">Producto</label>
          <select name="producto" className="field" value={currentProducto}>
            <option value="">Todos los productos</option>
            {catalogo.categorias.map(cat => (
              <optgroup key={cat.id} label={cat.nombre}>
                {catalogo.productos
                  .filter(p => p.categoria_id === cat.id)
                  .map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="block mb-1 text-sm font-medium">Tipo</label>
          <select name="tipo" className="field" value={currentTipo}>
            <option value="TODOS">Todos</option>
            <option value="INGRESO">Ingreso</option>
            <option value="EGRESO">Egreso</option>
          </select>
        </div>
        <div className="flex gap-2 self-end">
          <button type="submit" className="button-primary h-11">Filtrar</button>
          {hasFilters && <button type="button" onClick={handleClear} className="button-secondary h-11">Limpiar</button>}
        </div>
      </div>
    </form>
  );
}