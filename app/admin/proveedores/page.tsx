import { redirect } from "next/navigation";
import { pageSession } from "@/lib/data";
import { getProveedoresAdmin } from "@/lib/compras-admin";
import { ProveedoresAdmin } from "@/components/admin/ProveedoresAdmin";

export default async function AdminProveedoresPage() {
  const session = await pageSession();
  if (session.rol !== "DUEÑO") redirect("/hoy");
  const proveedores = await getProveedoresAdmin();
  return <div className="space-y-5">
    <header>
      <p className="eyebrow">Administración</p>
      <h1>Proveedores</h1>
      <p className="mt-2 text-zinc-600">Altas, contacto y estado. Sólo los proveedores activos se ofrecen al registrar compras.</p>
    </header>
    <ProveedoresAdmin proveedores={proveedores} />
  </div>;
}
