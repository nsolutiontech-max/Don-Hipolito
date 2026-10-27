import Link from "next/link";
import { pageSession } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase/server";
import { WhatsAppExportButton } from "@/components/pedidos/WhatsAppExportButton";
import type { Categoria, Producto } from "@/lib/types";
import { displayDate } from "@/lib/dates";

export default async function OrdersPage() {
  await pageSession(true);
  const db = await supabaseServer();
  const { data, error } = await db.from("pedidos").select("id,fecha,estado,pedido_items(cantidad,productos(*,categorias(*)))")
    .order("creado_en", { ascending: false }).limit(30);
  if (error) throw new Error("No se pudieron cargar los pedidos.");
  return <div className="space-y-4"><header><p className="eyebrow">Historial</p><h1>Pedidos guardados</h1>
    <p className="mt-2 text-sm text-zinc-600">Se muestran los últimos 30 pedidos. Compartir por WhatsApp no confirma su envío automáticamente.</p></header>
    {!data.length && <div className="panel"><p className="mb-4">Todavía no hay pedidos guardados.</p><Link className="button-primary" href="/stock">Completar un inventario</Link></div>}
    {data.map(order => {
      const items = order.pedido_items.map(item => {
        const product = item.productos as unknown as Producto & { categorias: Categoria };
        return { producto: product, categoria: product.categorias, cantidad: Number(item.cantidad) };
      });
      return <article className="panel" id={order.id} key={order.id}><h2>Pedido del {displayDate(order.fecha)}</h2>
        <p className="my-3 text-sm text-zinc-600">{order.estado} · {items.length} artículos</p>
        <WhatsAppExportButton items={items} fecha={displayDate(order.fecha)} />
      </article>;
    })}
  </div>;
}
