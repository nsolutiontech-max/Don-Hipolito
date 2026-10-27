import Link from "next/link";
import { getSheets, pageSession, fechaHoy } from "@/lib/data";
import { canOperate, sheetSlug } from "@/lib/permissions";
import { z } from "zod";

export default async function StockPage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const session = await pageSession();
  const sheets = await getSheets();
  const query = await searchParams;
  const date = z.iso.date().safeParse(query.fecha).success ? query.fecha! : fechaHoy();
  return <div className="space-y-5"><header><p className="eyebrow">Inventarios</p><h1>Stock y reposición</h1></header>
    <form className="panel flex flex-wrap items-end gap-3">
      <label className="flex-1"><span className="mb-1 block text-sm font-medium">Fecha de la planilla</span>
        <input className="field" type="date" name="fecha" defaultValue={date} required /></label>
      <button className="button-secondary">Ver fecha</button>
    </form>
    <div className="grid gap-3 sm:grid-cols-2">{sheets.map(sheet => <Link className="panel hover:border-emerald-600" key={sheet.id}
      href={`/conteo/${sheetSlug(sheet.codigo)}/${date}`}><h2>{sheet.nombre}</h2>
      <p className="mt-2 text-sm text-zinc-600">{sheet.codigo === "BEBIDAS" ? "Depósito y Heladera" : "Conteo y pedido diario"} →</p></Link>)}</div>
    {canOperate(session.rol) && <div className="flex gap-3"><Link className="button-secondary" href="/movimientos">Movimientos</Link><Link className="button-secondary" href="/pedidos">Pedidos guardados</Link></div>}
  </div>;
}
