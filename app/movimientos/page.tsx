import { redirect } from "next/navigation";
import { MovementForm } from "@/components/movimientos/MovementForm";
import { exigirSesion, getCatalogo, getMovimientosRecientes } from "@/lib/data";

export default async function MovimientosPage() {
  const sesion = await exigirSesion().catch(() => null);
  if (!sesion) redirect("/login");
  const [catalogo, recientes] = await Promise.all([
    getCatalogo(),
    getMovimientosRecientes(),
  ]);
  return (
    <MovementForm
      catalogo={catalogo}
      recientesServidor={recientes}
      responsableNombre={sesion.responsable_nombre ?? sesion.email}
    />
  );
}
