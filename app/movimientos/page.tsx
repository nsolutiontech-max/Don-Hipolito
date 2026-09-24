import { MovementForm } from "@/components/movimientos/MovementForm";
import { getCatalogo, getMovimientosRecientes } from "@/lib/data";
import { supabaseConfigurado } from "@/lib/supabase/server";

export default async function MovimientosPage() {
  const [catalogo, recientes] = await Promise.all([
    getCatalogo(),
    getMovimientosRecientes(),
  ]);
  return (
    <MovementForm
      catalogo={catalogo}
      recientesServidor={recientes}
      usaSupabase={supabaseConfigurado}
    />
  );
}
