import { redirect } from "next/navigation";
import { pageSession } from "@/lib/data";
import { getPlanillasAdmin, getProductosOpcion } from "@/lib/planillas-admin";
import { PlanillasAdmin } from "@/components/admin/PlanillasAdmin";

export default async function AdminPlanillasPage() {
  const session = await pageSession();
  if (session.rol !== "DUEÑO") redirect("/hoy");
  const [planillas, productos] = await Promise.all([getPlanillasAdmin(), getProductosOpcion()]);
  return <div className="space-y-5">
    <header>
      <p className="eyebrow">Administración</p>
      <h1>Planillas</h1>
      <p className="mt-2 text-zinc-600">Secciones, productos y orden de cada planilla. El conteo diario refleja estos cambios.</p>
    </header>
    <PlanillasAdmin planillas={planillas} productos={productos} />
  </div>;
}
