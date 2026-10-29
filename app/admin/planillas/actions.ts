"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { exigirDueno } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase/server";

const seccionPayload = z.object({ planillaId: z.uuid(), nombre: z.string().trim().min(1).max(80) });
const seccionIdPayload = z.object({ seccionId: z.uuid() });
const itemPayload = z.object({ planillaId: z.uuid(), seccionId: z.uuid(), productoId: z.uuid() });
const itemIdPayload = z.object({ itemId: z.uuid() });
const seccionesOrdenPayload = z.object({ planillaId: z.uuid(), ids: z.array(z.uuid()).min(1).max(200) });
const itemsOrdenPayload = z.object({ planillaId: z.uuid(), seccionId: z.uuid(), ids: z.array(z.uuid()).min(1).max(500) });

type ActionResult = { ok: boolean; error?: string };

function mensajeDeError(error: { code?: string; message?: string }): string {
  if (error.code === "23505") return "Ya existe un elemento con ese nombre o producto en la planilla.";
  if (error.message?.includes("Section not found")) return "La sección no existe o fue archivada.";
  if (error.message?.includes("Product not found")) return "El producto no existe o está inactivo.";
  if (error.message?.includes("Order does not match")) return "El orden cambió en otra pestaña. Recargá y volvé a intentar.";
  return "No se pudo completar la operación.";
}

async function invocar(nombre: string, parametros: Record<string, unknown>): Promise<ActionResult> {
  const db = await supabaseServer();
  const { error } = await db.rpc(nombre, parametros);
  if (error) return { ok: false, error: mensajeDeError(error) };
  revalidatePath("/admin/planillas");
  return { ok: true };
}

export async function crearSeccion(input: z.input<typeof seccionPayload>): Promise<ActionResult> {
  try {
    await exigirDueno();
    const parsed = seccionPayload.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Indicá un nombre de sección de hasta 80 caracteres." };
    return await invocar("agregar_seccion_planilla", { p_planilla: parsed.data.planillaId, p_nombre: parsed.data.nombre });
  } catch {
    return { ok: false, error: "No se pudo crear la sección." };
  }
}

export async function archivarSeccion(input: z.input<typeof seccionIdPayload>): Promise<ActionResult> {
  try {
    await exigirDueno();
    const parsed = seccionIdPayload.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Sección no válida." };
    return await invocar("archivar_seccion_planilla", { p_seccion: parsed.data.seccionId });
  } catch {
    return { ok: false, error: "No se pudo archivar la sección." };
  }
}

export async function agregarProducto(input: z.input<typeof itemPayload>): Promise<ActionResult> {
  try {
    await exigirDueno();
    const parsed = itemPayload.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Elegí una sección y un producto válidos." };
    return await invocar("agregar_item_planilla", {
      p_planilla: parsed.data.planillaId, p_seccion: parsed.data.seccionId, p_producto: parsed.data.productoId,
    });
  } catch {
    return { ok: false, error: "No se pudo agregar el producto." };
  }
}

export async function archivarProducto(input: z.input<typeof itemIdPayload>): Promise<ActionResult> {
  try {
    await exigirDueno();
    const parsed = itemIdPayload.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Producto de planilla no válido." };
    return await invocar("archivar_item_planilla", { p_item: parsed.data.itemId });
  } catch {
    return { ok: false, error: "No se pudo quitar el producto." };
  }
}

export async function reordenarSecciones(input: z.input<typeof seccionesOrdenPayload>): Promise<ActionResult> {
  try {
    await exigirDueno();
    const parsed = seccionesOrdenPayload.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Orden de secciones no válido." };
    return await invocar("reordenar_secciones_planilla", { p_planilla: parsed.data.planillaId, p_ids: parsed.data.ids });
  } catch {
    return { ok: false, error: "No se pudo reordenar las secciones." };
  }
}

export async function reordenarProductos(input: z.input<typeof itemsOrdenPayload>): Promise<ActionResult> {
  try {
    await exigirDueno();
    const parsed = itemsOrdenPayload.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Orden de productos no válido." };
    return await invocar("reordenar_items_planilla", {
      p_planilla: parsed.data.planillaId, p_seccion: parsed.data.seccionId, p_ids: parsed.data.ids,
    });
  } catch {
    return { ok: false, error: "No se pudo reordenar los productos." };
  }
}
