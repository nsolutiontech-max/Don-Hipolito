import type { Categoria, Producto } from "@/lib/data";

export type ItemPedido = {
  producto: Producto;
  categoria: Categoria;
  cantidad: number;
};

/** Agrupa por categoría y arma el texto listo para WhatsApp. */
export function armarMensajePedido(
  items: ItemPedido[],
  fecha: string,
  turno: string,
): string {
  const porCategoria = new Map<string, { categoria: string; lineas: string[] }>();
  for (const { producto, categoria, cantidad } of items) {
    if (!porCategoria.has(categoria.id)) {
      porCategoria.set(categoria.id, { categoria: categoria.nombre, lineas: [] });
    }
    porCategoria.get(categoria.id)!.lineas.push(
      `• ${producto.nombre}: ${cantidad} ${producto.unidad_medida}`,
    );
  }
  const bloques = [...porCategoria.values()].map(
    (g) => `*${g.categoria}*\n${g.lineas.join("\n")}`,
  );
  return `*PEDIDO HIPÓLITO ${fecha} ${turno}*\n\n${bloques.join("\n\n")}`;
}

export function whatsappUrl(mensaje: string): string {
  return `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
}
