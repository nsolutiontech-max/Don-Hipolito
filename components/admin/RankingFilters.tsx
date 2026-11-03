"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Catalogo } from "@/lib/data";
import type { Proveedor } from "@/lib/types";

export function RankingFilters({ categorias, productos, proveedores, desde, hasta }: {
  categorias: Catalogo["categorias"];
  productos: Catalogo["productos"];
  proveedores: Proveedor[];
  desde: string;
  hasta: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const getValue = (key: string) => searchParams.get(key) ?? "";
  const currentCategoria = getValue("categoria");
  const hasFilters = ["categoria", "producto", "proveedor", "orden"].some(key => searchParams.has(key));

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const params = new URLSearchParams();
    for (const [key, value] of data.entries()) {
      if (value) params.set(key, String(value));
    }
    router.push(`/admin/compras/ranking${params.toString() ? `?${params}` : ""}`);
  };

  return (
    <form onSubmit={handleSubmit} className="panel space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[160px]">
          <label className="block mb-1 text-sm font-medium" htmlFor="desde">Desde</label>
          <input className="field" id="desde" type="date" name="desde" value={desde} max={hasta} required />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block mb-1 text-sm font-medium" htmlFor="hasta">Hasta</label>
          <input className="field" id="hasta" type="date" name="hasta" value={hasta} required />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block mb-1 text-sm font-medium" htmlFor="categoria">Categoría</label>
          <select className="field" id="categoria" name="categoria" value={currentCategoria}>
            <option value="">Todas las categorías</option>
            {categorias.map(categoria =>
              <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block mb-1 text-sm font-medium" htmlFor="producto">Producto</label>
          <select className="field" id="producto" name="producto" value={getValue("producto")}>
            <option value="">Todos los productos</option>
            {categorias.map(categoria => (
              <optgroup key={categoria.id} label={categoria.nombre}>
                {productos.filter(producto => producto.categoria_id === categoria.id)
                  .map(producto => <option key={producto.id} value={producto.id}>{producto.nombre}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block mb-1 text-sm font-medium" htmlFor="proveedor">Proveedor</label>
          <select className="field" id="proveedor" name="proveedor" value={getValue("proveedor")}>
            <option value="">Todos los proveedores</option>
            {proveedores.map(proveedor =>
              <option key={proveedor.id} value={proveedor.id}>{proveedor.nombre}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="block mb-1 text-sm font-medium" htmlFor="orden">Ordenar por</label>
          <select className="field" id="orden" name="orden" value={getValue("orden") || "gasto"}>
            <option value="gasto">Más gastado</option>
            <option value="frecuencia">Más frecuente</option>
          </select>
        </div>
        <div className="flex gap-2 self-end">
          <button type="submit" className="button-primary h-11">Filtrar</button>
          {hasFilters && <button type="button" onClick={() => router.push(`/admin/compras/ranking?desde=${desde}&hasta=${hasta}`)} className="button-secondary h-11">Limpiar</button>}
        </div>
      </div>
    </form>
  );
}
