import { redirect } from "next/navigation";
import { DailyCountClient } from "@/components/conteo/DailyCountClient";
import { exigirSesion, fechaHoy, getCatalogo, getDetalles, type Turno } from "@/lib/data";

export default async function ConteoPage({
  params,
}: {
  params: Promise<{ fecha: string }>;
}) {
  const sesion = await exigirSesion().catch(() => null);
  if (!sesion) redirect("/login");
  if (!sesion.responsable_id) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
        Tu usuario no tiene responsable asignado. Pedile al dueño que lo configure.
      </p>
    );
  }
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
      responsableId={sesion.responsable_id}
      responsableNombre={sesion.responsable_nombre ?? sesion.email}
    />
  );
}
