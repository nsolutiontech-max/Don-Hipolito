import { redirect } from "next/navigation";
import { PedidosClient } from "@/components/pedidos/PedidosClient";
import { exigirSesion, getCatalogo } from "@/lib/data";

export default async function PedidosPage() {
  const sesion = await exigirSesion().catch(() => null);
  if (!sesion) redirect("/login");
  const catalogo = await getCatalogo();
  return <PedidosClient catalogo={catalogo} />;
}
