"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { exigirDueno } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase/server";
import { UNIDADES_MEDIDA } from "@/lib/constants";

const cantidad = z.number().finite().min(0).max(99999999.99);
const payload = z.object({
  id: z.uuid(),
  nombre: z.string().trim().min(1).max(200),
  categoria_id: z.uuid(),
  unidad_medida: z.enum(UNIDADES_MEDIDA),
  stock_minimo: cantidad,
  stock_ideal: cantidad.nullable(),
  activo: z.boolean(),
});

export async function actualizarProducto(input: z.input<typeof payload>): Promise<{ ok: boolean; error?: string }> {
  try {
    await exigirDueno();
    const parsed = payload.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Revisa el nombre, la categoría y las cantidades." };
    const { id, ...campos } = parsed.data;
    const db = await supabaseServer();
    const { error } = await db.from("productos").update(campos).eq("id", id);
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Ya existe un producto con ese nombre en esa categoría." };
      return { ok: false, error: "No se pudo guardar el producto. Verificá la conexión y los permisos." };
    }
    revalidatePath("/admin/catalogo");
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo guardar. Inicia sesión como dueño e inténtalo otra vez." };
  }
}
