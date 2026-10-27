import { redirect } from "next/navigation";
import { pageSession } from "@/lib/data";
import { getCatalogoAdmin } from "@/lib/catalog-admin";
import { CatalogAdmin } from "@/components/admin/CatalogAdmin";

export default async function CatalogoAdminPage() {
  const session = await pageSession();
  if (session.rol !== "DUEÑO") redirect("/hoy");
  const { categorias, productos } = await getCatalogoAdmin();
  return <div className="space-y-4">
    <header><p className="eyebrow">Administración</p><h1>Catálogo de productos</h1>
      <p className="mt-2 text-sm text-zinc-600">Definí unidades, mínimos, objetivos y estado de cada artículo del negocio.</p></header>
    <CatalogAdmin categorias={categorias} productos={productos} />
  </div>;
}
