import Link from "next/link";
import { pageSession } from "@/lib/data";
import { canOperate } from "@/lib/permissions";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default async function MorePage() {
  const session = await pageSession();
  return <div className="space-y-4"><h1>Más opciones</h1><div className="panel space-y-3">
    <p className="font-semibold">{session.email}</p><p className="text-sm text-zinc-600">Rol: {session.rol}</p>
    {canOperate(session.rol) && <div className="flex flex-wrap gap-2"><Link className="button-secondary" href="/movimientos">Movimientos</Link><Link className="button-secondary" href="/pedidos">Pedidos</Link></div>}
    {session.rol === "DUEÑO" && <div className="flex flex-wrap gap-2"><Link className="button-secondary" href="/auditorias">Auditorías</Link>
      <Link className="button-secondary" href="/entrevistas">Entrevistas</Link>
      <Link className="button-secondary" href="/admin">Administración</Link></div>}
    <div><LogoutButton /></div>
  </div></div>;
}
