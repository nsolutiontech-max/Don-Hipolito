import Link from "next/link";
import { pageSession } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase/server";
import { WhatsAppExportButton } from "@/components/pedidos/WhatsAppExportButton";
import { OrderStateButtons } from "@/components/pedidos/OrderStateButtons";
import type { Categoria, Producto } from "@/lib/types";
import { displayDate } from "@/lib/dates";

const ESTADOS = ["TODOS", "PENDIENTE", "ENVIADO", "RECIBIDO"] as const;
const ESTADO_CLASES: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-900",
  ENVIADO: "bg-zinc-200 text-zinc-800",
  RECIBIDO: "bg-emerald-100 text-emerald-900",
};

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await pageSession(true);
  const params = await searchParams;
  const estado = ESTADOS.includes(params.estado as (typeof ESTADOS)[number]) ? params.estado! : "TODOS";
  const fecha = params.fecha && /^\d{4}-\d{2}-\d{2}$/.test(params.fecha) ? params.fecha : "";
  const db = await supabaseServer();
  let query = db.from("pedidos").select("id,fecha,estado,pedido_items(cantidad,productos(*,categorias(*)))");
  if (estado !== "TODOS") query = query.eq("estado", estado);
  if (fecha) query = query.eq("fecha", fecha);
  const { data, error } = await query.order("creado_en", { ascending: false }).limit(30);
  if (error) throw new Error("No se pudieron cargar los pedidos.");
  const chip = (nivel: (typeof ESTADOS)[number]) => {
    const query = new URLSearchParams();
    if (nivel !== "TODOS") query.set("estado", nivel);
    if (fecha) query.set("fecha", fecha);
    const sufijo = query.toString() ? `?${query.toString()}` : "";
    const activo = estado === nivel;
    return <Link key={nivel} href={`/pedidos${sufijo}`}
      className={activo ? "rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white" : "rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-200"}>
      {nivel === "TODOS" ? "Todos" : nivel.charAt(0) + nivel.slice(1).toLowerCase()}</Link>;
  };
  return <div className="space-y-4"><header><p className="eyebrow">Historial</p><h1>Pedidos guardados</h1>
    <p className="mt-2 text-sm text-zinc-600">Se muestran los últimos 30 pedidos con filtro por estado y fecha. Compartir por WhatsApp no confirma su envío automáticamente.</p></header>
    <div className="panel flex flex-wrap items-center gap-2">
      {ESTADOS.map(nivel => chip(nivel))}
      <form className="ml-auto flex items-center gap-2" action="/pedidos" method="get">
        <input type="hidden" name="estado" value={estado} />
        <label><span className="mb-1 block text-xs font-medium text-zinc-600">Fecha</span>
          <input type="date" name="fecha" defaultValue={fecha} className="field" /></label>
        <button className="button-secondary self-end">Aplicar</button>
        {fecha && <Link className="button-secondary self-end" href={`/pedidos${estado === "TODOS" ? "" : `?estado=${estado}`}`}>Quitar</Link>}
      </form>
    </div>
    {!data.length && <div className="panel"><p className="mb-4">No hay pedidos para el filtro elegido.</p><Link className="button-primary" href="/stock">Completar un inventario</Link></div>}
    {data.map(order => {
      const items = order.pedido_items.map(item => {
        const product = item.productos as unknown as Producto & { categorias: Categoria };
        return { producto: product, categoria: product.categorias, cantidad: Number(item.cantidad) };
      });
      return <article className="panel" id={order.id} key={order.id}>
        <div className="flex flex-wrap items-center gap-2">
          <h2>Pedido del {displayDate(order.fecha)}</h2>
          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${ESTADO_CLASES[order.estado] ?? ""}`}>{order.estado}</span>
          <span className="text-sm text-zinc-600">{items.length} artículos</span>
        </div>
        <OrderStateButtons id={order.id} estado={order.estado} />
        <WhatsAppExportButton items={items} fecha={displayDate(order.fecha)} />
      </article>;
    })}
  </div>;
}
