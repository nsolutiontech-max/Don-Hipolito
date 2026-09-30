import { redirect } from "next/navigation";
import { exigirSesion } from "@/lib/data";

// Panel del dueño. Día 3: ABM de productos, proveedores, precios y usuarios.
// Día 4: reportes y gráficos.
export default async function AdminPage() {
  const sesion = await exigirSesion().catch(() => null);
  if (!sesion) redirect("/login");
  if (sesion.rol !== "DUEÑO") redirect("/conteo/hoy");
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6">
      <h1 className="text-lg font-bold">Panel del dueño</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Hola {sesion.responsable_nombre ?? sesion.email}. Acá vas a gestionar
        productos, proveedores, precios, usuarios y ver los reportes.
      </p>
      <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
        En construcción (Días 3 y 4). Por ahora el catálogo se edita por base de datos.
      </p>
    </div>
  );
}
