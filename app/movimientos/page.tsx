import { MovementForm } from "@/components/movimientos/MovementForm";
import { pageSession, getCatalogo, getMovimientosRecientes } from "@/lib/data";

export default async function MovimientosPage() {
  const sesion = await pageSession(true);
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
