import { getCatalogo, getMovimientosFiltrados, pageSession } from "@/lib/data";
import { MovementForm } from "@/components/movimientos/MovementForm";
import { MovementFilters } from "@/components/movimientos/MovementFilters";

export default async function MovimientosPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sesion = await pageSession(true);
  const params = await searchParams;

  const tipo: "INGRESO" | "EGRESO" | "TODOS" = params.tipo === "INGRESO" || params.tipo === "EGRESO" ? params.tipo : "TODOS";
  const filtros = {
    fechaDesde: params.desde,
    fechaHasta: params.hasta,
    producto_id: params.producto,
    tipo,
    limit: 50,
    offset: 0,
  };

  const [catalogo, movimientos] = await Promise.all([
    getCatalogo(),
    getMovimientosFiltrados(filtros),
  ]);

  const total = movimientos.length;
  const hasFilters = Boolean(params.desde || params.hasta || params.producto || params.tipo);

  return (
    <div className="space-y-4">
      <header>
        <p className="eyebrow">Operativa</p>
        <h1>Movimientos de stock</h1>
        <p className="mt-2 text-sm text-zinc-600">
          {hasFilters
            ? `Mostrando ${total} movimiento${total !== 1 ? "s" : ""} filtrado${total !== 1 ? "s" : ""}`
            : "Últimos 20 movimientos. Usá los filtros para ver el historial completo."}
        </p>
      </header>
      <MovementFilters catalogo={catalogo} />
      <MovementForm
        catalogo={catalogo}
        recientesServidor={movimientos}
        responsableNombre={sesion.responsable_nombre ?? sesion.email}
      />
    </div>
  );
}