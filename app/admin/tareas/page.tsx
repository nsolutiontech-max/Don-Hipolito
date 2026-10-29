import { redirect } from "next/navigation";
import { pageSession } from "@/lib/data";
import { getTareasAdmin } from "@/lib/tasks";
import { TareasAdmin } from "@/components/admin/TareasAdmin";

export default async function AdminTareasPage() {
  const session = await pageSession();
  if (session.rol !== "DUEÑO") redirect("/hoy");
  const tareas = await getTareasAdmin();
  return <div className="space-y-5">
    <header>
      <p className="eyebrow">Administración</p>
      <h1>Frecuencias de tareas</h1>
      <p className="mt-2 text-zinc-600">Definí cuándo corresponde cada actividad. Las semanales se completan una vez por semana y las de “según necesidad” quedan fuera del progreso obligatorio.</p>
    </header>
    <TareasAdmin tareas={tareas} />
  </div>;
}
