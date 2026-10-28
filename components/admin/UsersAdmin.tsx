"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { alternarUsuario, crearUsuario, resetearPassword } from "@/app/admin/usuarios/actions";
import type { UsuarioAdmin } from "@/lib/users-admin";

type Responsable = { id: string; nombre: string };
const ROLES = [["DUEÑO", "Dueño"], ["ENCARGADO", "Encargado"], ["CAMARERO", "Camarero"]] as const;

export function UsersAdmin({ usuarios, responsables, currentUserId }: {
  usuarios: UsuarioAdmin[]; responsables: Responsable[]; currentUserId: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [nuevas, setNuevas] = useState<Record<string, string>>({});

  const anunciar = (email: string, password: string) => setNuevas(prev => ({ ...prev, [email]: password }));
  const ejecutar = async (clave: string, tarea: () => Promise<{ ok: boolean; password?: string; error?: string }>, email?: string) => {
    setSaving(clave); setMessage(""); setError("");
    try {
      const resultado = await tarea();
      if (!resultado.ok) { setError(resultado.error ?? "Operación fallida."); return; }
      if (email && resultado.password) anunciar(email, resultado.password);
      setMessage("Operación completada. Copiá la contraseña ahora: no se vuelve a mostrar.");
      router.refresh();
    } catch { setError("No se pudo conectar. Volvé a intentar."); }
    finally { setSaving(""); }
  };

  return <div className="space-y-4">
    <section className="panel">
      <h2>Crear usuario</h2>
      <form className="mt-3 grid gap-3 sm:grid-cols-2" action={form => {
        const email = String(form.get("email"));
        void ejecutar(`crear:${email}`, () => crearUsuario({
          email, rol: String(form.get("rol")) as "DUEÑO" | "ENCARGADO" | "CAMARERO",
          responsableId: String(form.get("responsableId")) || null, password: String(form.get("password")),
        }), email);
      }}>
        <label><span className="mb-1 block text-xs font-medium text-zinc-600">Email</span>
          <input className="field" type="email" name="email" required maxLength={200} /></label>
        <label><span className="mb-1 block text-xs font-medium text-zinc-600">Rol</span>
          <select className="field" name="rol" defaultValue="ENCARGADO">
            {ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
        <label><span className="mb-1 block text-xs font-medium text-zinc-600">Responsable (opcional)</span>
          <select className="field" name="responsableId" defaultValue="">
            <option value="">Sin responsable</option>
            {responsables.map(responsable => <option key={responsable.id} value={responsable.id}>{responsable.nombre}</option>)}
          </select></label>
        <label><span className="mb-1 block text-xs font-medium text-zinc-600">Contraseña (vacío = generar)</span>
          <input className="field" name="password" minLength={8} maxLength={100} placeholder="mínimo 8 caracteres" /></label>
        <button className="button-primary sm:col-span-2" disabled={Boolean(saving)}>Crear acceso</button>
      </form>
    </section>
    {(message || error) && <p className={`panel text-sm ${error ? "text-red-700" : "text-emerald-800"}`} role="status">{error || message}</p>}
    <section className="space-y-3">
      <h2>Usuarios ({usuarios.length})</h2>
      {usuarios.map(usuario => {
        const clave = `usuario:${usuario.id}`;
        return <article className="panel" key={usuario.id}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{usuario.email}</p>
            <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">{usuario.rol}</span>
            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${usuario.activo ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-800"}`}>
              {usuario.activo ? "Activo" : "Inactivo"}</span>
            <span className="text-xs text-zinc-600">{usuario.responsable_nombre ? `Responsable: ${usuario.responsable_nombre}` : "Sin responsable"}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="button-secondary" disabled={Boolean(saving)} onClick={() => ejecutar(clave, () => resetearPassword({ id: usuario.id }), usuario.email)}>
              Resetear contraseña</button>
            <button className={usuario.activo ? "button-secondary" : "button-primary"} disabled={Boolean(saving)}
              onClick={() => ejecutar(clave, () => alternarUsuario({ id: usuario.id, activo: !usuario.activo }))}>
              {usuario.activo ? "Desactivar" : "Activar"}</button>
            {usuario.id === currentUserId && <span className="text-xs text-zinc-500 self-center">(tu cuenta)</span>}
          </div>
          {nuevas[usuario.email] && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Contraseña de <strong>{usuario.email}</strong>: <code className="break-all">{nuevas[usuario.email]}</code> · cópiala ahora, no se vuelve a mostrar.
          </p>}
        </article>;
      })}
    </section>
  </div>;
}
