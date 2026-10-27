"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { exigirOperador } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase/server";

export async function guardarPedido(inventoryId: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    await exigirOperador();
    if (!z.uuid().safeParse(inventoryId).success) return { ok: false, error: "Inventario no válido." };
    const db = await supabaseServer();
    const { data: id, error } = await db.rpc("crear_pedido_con_items", { p_inventario_id: inventoryId });
    if (error) return { ok: false, error: "El conteo se guardó. Para generar un pedido debe haber artículos contados con cantidades a pedir." };
    revalidatePath("/pedidos");
    return { ok: true, id };
  } catch { return { ok: false, error: "No se pudo generar el pedido. Comprueba tu sesión y vuelve a intentar." }; }
}
