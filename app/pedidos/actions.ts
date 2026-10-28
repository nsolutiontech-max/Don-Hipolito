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

const estadoPayload = z.object({ id: z.uuid(), estado: z.enum(["ENVIADO", "RECIBIDO"]) });

export async function cambiarEstadoPedido(input: z.input<typeof estadoPayload>): Promise<{ ok: boolean; error?: string }> {
  try {
    await exigirOperador();
    const parsed = estadoPayload.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Estado no válido." };
    const db = await supabaseServer();
    const { data, error } = await db.from("pedidos").update({ estado: parsed.data.estado })
      .eq("id", parsed.data.id).select("id");
    if (error) return { ok: false, error: "No se pudo actualizar el pedido." };
    if (!data?.length) return { ok: false, error: "Pedido no encontrado o sin permiso." };
    revalidatePath("/pedidos");
    return { ok: true };
  } catch { return { ok: false, error: "No se pudo actualizar el pedido." }; }
}
