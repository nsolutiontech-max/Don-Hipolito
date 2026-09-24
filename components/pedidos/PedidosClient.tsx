"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { WhatsAppExportButton } from "@/components/pedidos/WhatsAppExportButton";
import { guardarPedido } from "@/app/pedidos/actions";
import type { ItemPedido } from "@/lib/whatsapp";
import type { Catalogo, DetalleConteo, Turno } from "@/lib/data";

type BorradorPedido = {
  fecha: string;
  turno: Turno;
  responsableId: string | null;
  items: DetalleConteo[];
};

export function PedidosClient({
  catalogo,
  usaSupabase,
}: {
  catalogo: Catalogo;
  usaSupabase: boolean;
}) {
  const [borrador] = useState<BorradorPedido | null>(() => {
    try {
      if (typeof window === "undefined") return null;
      const raw = localStorage.getItem("hipolito-ultimo-pedido");
      return raw ? (JSON.parse(raw) as BorradorPedido) : null;
    } catch {
      return null;
    }
  });
  const [aviso, setAviso] = useState<string | null>(null);

  const items: ItemPedido[] = useMemo(() => {
    if (!borrador) return [];
    const prods = new Map(catalogo.productos.map((p) => [p.id, p]));
    const cats = new Map(catalogo.categorias.map((c) => [c.id, c]));
    return borrador.items
      .filter((d) => (d.cantidad_pedida ?? d.cantidad_sugerida) > 0)
      .map((d) => ({
        producto: prods.get(d.producto_id)!,
        categoria: cats.get(prods.get(d.producto_id)!.categoria_id)!,
        cantidad: d.cantidad_pedida ?? d.cantidad_sugerida,
      }))
      .filter((i) => i.producto && i.categoria)
      .sort((a, b) =>
        a.categoria.orden !== b.categoria.orden
          ? a.categoria.orden - b.categoria.orden
          : a.producto.nombre.localeCompare(b.producto.nombre),
      );
  }, [borrador, catalogo]);

  const nombreResponsable =
    catalogo.responsables.find((r) => r.id === borrador?.responsableId)?.nombre ?? "—";

  const onConfirmar = async () => {
    if (!borrador) return;
    if (!usaSupabase) {
      setAviso("Pedido confirmado en este dispositivo (modo demo).");
      return;
    }
    const r = await guardarPedido(
      borrador.fecha,
      items.map((i) => ({ producto_id: i.producto.id, cantidad: i.cantidad })),
    );
    setAviso(r.ok ? "Pedido guardado como PENDIENTE ✓" : `Error: ${r.error}`);
  };

  if (!borrador) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center">
        <p className="text-zinc-600">Todavía no generaste ningún pedido.</p>
        <Link
          href="/conteo/hoy"
          className="mt-3 inline-block rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white"
        >
          Ir al conteo de hoy
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <h1 className="font-bold">
          Pedido {borrador.fecha} · {borrador.turno === "MEDIODIA" ? "Mediodía" : "Noche"}
        </h1>
        <p className="text-sm text-zinc-500">
          Responsable: {nombreResponsable} · {items.length} items
        </p>
      </div>
      {aviso && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{aviso}</p>}
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <WhatsAppExportButton items={items} fecha={borrador.fecha} turno={borrador.turno} />
        <button
          type="button"
          onClick={onConfirmar}
          className="mt-2 h-12 w-full rounded-lg border-2 border-emerald-700 font-semibold text-emerald-800"
        >
          Confirmar pedido
        </button>
      </div>
    </div>
  );
}
