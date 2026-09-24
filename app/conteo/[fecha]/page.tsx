import { DailyCountClient } from "@/components/conteo/DailyCountClient";
import { fechaHoy, getCatalogo, getDetalles, type Turno } from "@/lib/data";
import { supabaseConfigurado } from "@/lib/supabase/server";

export default async function ConteoPage({
  params,
}: {
  params: Promise<{ fecha: string }>;
}) {
  const { fecha: param } = await params;
  const fecha = param === "hoy" ? fechaHoy() : param;
  // El turno por defecto es NOCHE; los detalles se recargan al cambiarlo en el cliente.
  const turno: Turno = "NOCHE";
  const [catalogo, detalles] = await Promise.all([
    getCatalogo(),
    getDetalles(fecha, turno),
  ]);
  return (
    <DailyCountClient
      fecha={fecha}
      catalogo={catalogo}
      detallesIniciales={detalles}
      usaSupabase={supabaseConfigurado}
    />
  );
}
