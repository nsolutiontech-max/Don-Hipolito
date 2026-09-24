import { PedidosClient } from "@/components/pedidos/PedidosClient";
import { getCatalogo } from "@/lib/data";
import { supabaseConfigurado } from "@/lib/supabase/server";

export default async function PedidosPage() {
  const catalogo = await getCatalogo();
  return <PedidosClient catalogo={catalogo} usaSupabase={supabaseConfigurado} />;
}
