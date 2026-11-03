import Link from "next/link";
import { redirect } from "next/navigation";
import { getCatalogo, pageSession } from "@/lib/data";
import { getProveedoresAdmin } from "@/lib/compras-admin";
import { getRankingCompras, hoyBA, inicioDeMesBA } from "@/lib/compras-ranking";
import { RankingFilters } from "@/components/admin/RankingFilters";

const esFecha = (valor?: string): valor is string => Boolean(valor && /^\d{4}-\d{2}-\d{2}$/.test(valor));

export default async function RankingComprasPage({ searchParams }: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await pageSession(true);
  if (session.rol !== "DUEÑO") redirect("/hoy");
  const params = await searchParams;
  const desde = esFecha(params.desde) ? params.desde : inicioDeMesBA();
  const hasta = esFecha(params.hasta) ? params.hasta : hoyBA();
  const orden = params.orden === "frecuencia" ? "frecuencia" : "gasto";

  const [catalogo, proveedores, filasBrutas] = await Promise.all([
    getCatalogo(),
    getProveedoresAdmin(),
    getRankingCompras({ desde, hasta, categoria: params.categoria, producto: params.producto, proveedor: params.proveedor }),
  ]);
  const filas = orden === "frecuencia"
    ? [...filasBrutas].sort((a, b) => b.compras - a.compras || b.gasto_ars - a.gasto_ars)
    : filasBrutas;

  const gastoTotal = filas.reduce((suma, fila) => suma + fila.gasto_ars, 0);
  const comprasTotales = filas.reduce((suma, fila) => suma + fila.compras, 0);
  const lineasCompletas = filas.reduce((suma, fila) => suma + fila.lineas_completas, 0);
  const lineasIncompletas = filas.reduce((suma, fila) => suma + fila.lineas_incompletas, 0);
  const cobertura = lineasCompletas + lineasIncompletas > 0
    ? Math.round((lineasCompletas / (lineasCompletas + lineasIncompletas)) * 100)
    : null;

  const importe = (valor: number) => `$${valor.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
  const numero = (valor: number) => valor.toLocaleString("es-AR", { maximumFractionDigits: 3 });
  const formatearFecha = (fecha: string | null) =>
    fecha ? new Date(fecha).toLocaleDateString("es-AR") : "—";
  const top = filas.slice(0, 8);
  const maxGasto = top.reduce((max, fila) => Math.max(max, fila.gasto_ars), 0);

  return <div className="space-y-5">
    <header>
      <p className="eyebrow">Administración</p>
      <h1>Ranking de compras</h1>
      <p className="mt-2 max-w-2xl text-zinc-600">Qué productos concentran el gasto en ARS del período. La cantidad base se muestra por producto (nunca se suman unidades incompatibles) y cada compra guarda el factor con el que se cargó.</p>
      <Link className="mt-2 inline-block text-sm underline" href="/admin/compras">← Volver a Compras</Link>
    </header>
    <RankingFilters categorias={catalogo.categorias} productos={catalogo.productos}
      proveedores={proveedores} desde={desde} hasta={hasta} />
    {lineasIncompletas > 0 && <p className="panel text-sm text-amber-800" role="status">Hay {lineasIncompletas} compra{lineasIncompletas !== 1 ? "s" : ""} sin factor de conversión confirmado: suman al gasto pero no a la cantidad base. Corregilas desde <Link className="underline" href="/admin/compras">Compras → Datos por corregir</Link>.</p>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="panel"><p className="eyebrow">Gasto del período</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{importe(gastoTotal)}</p></div>
      <div className="panel"><p className="eyebrow">Productos con compras</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{filas.length}</p></div>
      <div className="panel"><p className="eyebrow">Compras registradas</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{comprasTotales}</p></div>
      <div className="panel"><p className="eyebrow">Base confirmada</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{cobertura === null ? "—" : `${cobertura}%`}</p>
        <p className="mt-1 text-xs text-zinc-600">{lineasIncompletas} línea{lineasIncompletas !== 1 ? "s" : ""} incompleta{lineasIncompletas !== 1 ? "s" : ""}</p></div>
    </div>
    {filas.length === 0 ? <p className="panel text-sm text-zinc-600">No hay compras cargadas en el período seleccionado.</p> : <>
      <section className="panel" aria-labelledby="ranking-mayor-gasto">
        <h2 id="ranking-mayor-gasto">Mayor gasto del período</h2>
        <ol className="mt-3 space-y-2">
          {top.map((fila, indice) => <li key={fila.producto_id} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-2">
            <span className="text-xs tabular-nums text-zinc-500">{indice + 1}.</span>
            <div>
              <p className="text-sm font-medium leading-tight">{fila.producto_nombre}</p>
              <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-zinc-100" aria-hidden="true">
                <div className="h-full rounded-full bg-emerald-700" style={{ width: `${maxGasto > 0 ? (fila.gasto_ars / maxGasto) * 100 : 0}%` }} />
              </div>
            </div>
            <span className="text-xs tabular-nums text-zinc-700">{importe(fila.gasto_ars)}</span>
          </li>)}
        </ol>
      </section>
      <section className="panel" aria-labelledby="ranking-tabla">
        <h2 id="ranking-tabla">Detalle por producto</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-3">Producto</th><th className="py-2 pr-3">Categoría</th>
                <th className="py-2 pr-3 text-right">Gasto</th><th className="py-2 pr-3 text-right">Part.</th>
                <th className="py-2 pr-3 text-right">Base</th><th className="py-2 pr-3 text-right">Compras</th>
                <th className="py-2 text-right">Última</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(fila => <tr key={fila.producto_id} className="border-b border-zinc-100 align-top last:border-0">
                <td className="py-2 pr-3 font-medium">{fila.producto_nombre}</td>
                <td className="py-2 pr-3 text-zinc-600">{fila.categoria_nombre}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{importe(fila.gasto_ars)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{fila.participacion_pct === null ? "—" : `${numero(fila.participacion_pct)}%`}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{fila.lineas_completas === 0
                  ? <span className="text-amber-800">sin base confirmada</span>
                  : <>{numero(fila.cantidad_base ?? 0)} {fila.unidad_base}
                      {fila.lineas_incompletas > 0 && <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-semibold uppercase text-amber-900">parcial</span>}</>}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{fila.compras}</td>
                <td className="py-2 text-right">{formatearFecha(fila.ultima_compra)}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </>}
  </div>;
}
