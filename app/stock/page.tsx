import Link from "next/link";
import { getSheets, pageSession, fechaHoy } from "@/lib/data";
import { canOperate, sheetSlug } from "@/lib/permissions";
import { displayDate } from "@/lib/dates";
import { z } from "zod";

export default async function StockPage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const session = await pageSession();
  const sheets = await getSheets();
  const query = await searchParams;
  const date = z.iso.date().safeParse(query.fecha).success ? query.fecha! : fechaHoy();
  return <div className="space-y-5"><header><p className="eyebrow">Inventarios</p><h1>Stock y reposición</h1>
    <p className="mt-2 text-sm text-zinc-600">La fecha elegida se aplica a las planillas y a sus historiales.</p></header>
    <form className="panel flex flex-wrap items-end gap-3" action="/stock" method="get">
      <label className="flex-1"><span className="mb-1 block text-sm font-medium">Fecha de la planilla</span>
        <input className="field" type="date" name="fecha" defaultValue={date} required /></label>
      <button className="button-secondary">Ver fecha</button>
      {date !== fechaHoy() && <Link className="button-secondary" href="/stock">Hoy</Link>}
    </form>
    <p className="text-sm text-zinc-600">Fecha consultada: <span className="font-semibold">{displayDate(date)}</span></p>
    <div className="grid gap-3 sm:grid-cols-2">{sheets.map(sheet => <article className="panel" key={sheet.id}>
      <h2>{sheet.nombre}</h2>
      <p className="mt-2 text-sm text-zinc-600">{sheet.codigo === "BEBIDAS" ? "Depósito y Heladera" : "Conteo y pedido diario"}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link className="button-primary flex-1" href={`/conteo/${sheetSlug(sheet.codigo)}/${date}`}>Abrir {displayDate(date)}</Link>
        <Link className="button-secondary flex-1" href={`/conteo/${sheetSlug(sheet.codigo)}`}>Historial</Link>
      </div>
    </article>)}</div>
    {canOperate(session.rol) && <div className="flex gap-3"><Link className="button-secondary" href="/movimientos">Movimientos</Link><Link className="button-secondary" href="/pedidos">Pedidos guardados</Link></div>}
  </div>;
}
