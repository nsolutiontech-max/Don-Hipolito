"use server";

import { z } from "zod";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { exigirDueno } from "@/lib/data";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

const crearPayload = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  rol: z.enum(["DUEÑO", "ENCARGADO", "CAMARERO"]),
  responsableId: z.uuid().nullable(),
  password: z.string().min(8).max(100).optional().or(z.literal("")),
});
const idPayload = z.object({ id: z.uuid() });
const estadoPayload = z.object({ id: z.uuid(), activo: z.boolean() });

type ActionResult = { ok: boolean; password?: string; error?: string };

export async function crearUsuario(input: z.input<typeof crearPayload>): Promise<ActionResult> {
  try {
    await exigirDueno();
    const parsed = crearPayload.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Revisa el email, el rol y la contraseña (mínimo 8 caracteres)." };
    const { email, rol, responsableId } = parsed.data;
    const password = parsed.data.password?.trim() || randomBytes(9).toString("base64url");
    const admin = await supabaseAdmin();
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data?.user) return { ok: false, error: "No se pudo crear la cuenta de acceso." };
    const db = await supabaseServer();
    const { error: perfilError } = await db.from("usuarios")
      .insert({ id: data.user.id, email, rol, responsable_id: responsableId, activo: true });
    if (perfilError) {
      await admin.auth.admin.deleteUser(data.user.id);
      return { ok: false, error: "La cuenta se creó pero el perfil falló; se deshizo el alta." };
    }
    revalidatePath("/admin/usuarios");
    return { ok: true, password };
  } catch {
    return { ok: false, error: "No se pudo crear el usuario." };
  }
}

export async function resetearPassword(input: z.input<typeof idPayload>): Promise<ActionResult> {
  try {
    await exigirDueno();
    const parsed = idPayload.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Usuario no válido." };
    const password = randomBytes(9).toString("base64url");
    const admin = await supabaseAdmin();
    const { error } = await admin.auth.admin.updateUserById(parsed.data.id, { password });
    if (error) return { ok: false, error: "No se pudo restablecer la contraseña." };
    return { ok: true, password };
  } catch {
    return { ok: false, error: "No se pudo restablecer la contraseña." };
  }
}

export async function alternarUsuario(input: z.input<typeof estadoPayload>): Promise<ActionResult> {
  try {
    const session = await exigirDueno();
    const parsed = estadoPayload.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Usuario no válido." };
    if (!parsed.data.activo && parsed.data.id === session.id) {
      return { ok: false, error: "No podés desactivar tu propia cuenta." };
    }
    const db = await supabaseServer();
    const { error } = await db.from("usuarios").update({ activo: parsed.data.activo }).eq("id", parsed.data.id);
    if (error) return { ok: false, error: "No se pudo actualizar el usuario." };
    revalidatePath("/admin/usuarios");
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo actualizar el usuario." };
  }
}
