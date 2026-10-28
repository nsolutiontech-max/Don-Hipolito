import { redirect } from "next/navigation";
import { pageSession } from "@/lib/data";
import { listResponsablesActivos, listUsuariosAdmin } from "@/lib/users-admin";
import { UsersAdmin } from "@/components/admin/UsersAdmin";

export default async function UsuariosAdminPage() {
  const session = await pageSession();
  if (session.rol !== "DUEÑO") redirect("/hoy");
  const [usuarios, responsables] = await Promise.all([listUsuariosAdmin(), listResponsablesActivos()]);
  return <div className="space-y-4">
    <header><p className="eyebrow">Administración</p><h1>Gestión de usuarios</h1>
      <p className="mt-2 text-sm text-zinc-600">Cuentas de acceso, roles y responsables. Las contraseñas se muestran una sola vez.</p></header>
    <UsersAdmin usuarios={usuarios} responsables={responsables} currentUserId={session.id} />
  </div>;
}
