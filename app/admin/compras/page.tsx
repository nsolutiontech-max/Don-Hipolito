import { redirect } from "next/navigation";
import { pageSession } from "@/lib/data";
import { getComprasAdmin, getComprasIncompletas, getProductosCompra, getProveedoresAdmin } from "@/lib/compras-admin";
import { ComprasAdmin } from "@/components/admin/ComprasAdmin";

export default async function AdminComprasPage() {
  const session = await pageSession(true);
  if (session.rol !== "DUEÑO" && session.rol !== "ENCARGADO") redirect("/hoy");
  const [proveedores, productos, compras, incompletas] = await Promise.all([
    getProveedoresAdmin(), getProductosCompra(), getComprasAdmin(30), getComprasIncompletas(50),
  ]);
  return <div className="space-y-5">
    <header>
      <p className="eyebrow">Administración</p>
      <h1>Compras</h1>
      <p className="mt-2 text-zinc-600">Cada compra queda ligada a un proveedor y genera su movimiento de ingreso al stock. La unidad base del producto y el factor confirmado calculan la cantidad base; lo que esté sin factor queda en la bandeja para revisión.</p>
    </header>
    <ComprasAdmin proveedores={proveedores.filter(proveedor => proveedor.activo)}
      productos={productos} compras={compras} incompletas={incompletas}
      esDueno={session.rol === "DUEÑO"} />
  </div>;
}
