"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { exigirDueno } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase/server";

const nombre = z.string().trim().min(1).max(120);
const telefono = z.string().trim().max(60).optional().or(z.literal(""));
const crearPayload = z.object({ nombre, telefono });
const actualizarPayload = z.object({ id: z.uuid(), nombre, telefono, activo: z.boolean() });

type ActionResult = { ok: boolean; error?: string };

function revalidar() {
  revalidatePath("/admin/proveedores");
  revalidatePath("/admin/compras");
}

export async function crearProveedor(input: z.input<typeof crearPayload>): Promise<ActionResult> {
  try {
    await exigirDueno();
    const parsed = crearPayload.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Revisá el nombre y el teléfono." };
    const db = await supabaseServer();
    const { error } = await db.from("proveedores").insert({
      nombre: parsed.data.nombre, telefono: parsed.data.telefono?.trim() || null,
    });
    if (error) return {
      ok: false,
      error: error.code === "23505" ? "Ya existe un proveedor con ese nombre." : "No se pudo crear el proveedor.",
    };
    revalidar();
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo crear el proveedor." };
  }
}

export async function actualizarProveedor(input: z.input<typeof actualizarPayload>): Promise<ActionResult> {
  try {
    await exigirDueno();
    const parsed = actualizarPayload.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Revisá el nombre, el teléfono y el estado." };
    const db = await supabaseServer();
    const { error } = await db.from("proveedores").update({
      nombre: parsed.data.nombre, telefono: parsed.data.telefono?.trim() || null, activo: parsed.data.activo,
    }).eq("id", parsed.data.id);
    if (error) return {
      ok: false,
      error: error.code === "23505" ? "Ya existe un proveedor con ese nombre." : "No se pudo actualizar el proveedor.",
    };
    revalidar();
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo actualizar el proveedor." };
  }
}
