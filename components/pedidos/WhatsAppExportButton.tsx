"use client";

import { armarMensajePedido, whatsappUrl, type ItemPedido } from "@/lib/whatsapp";

export function WhatsAppExportButton({
  items,
  fecha,
  turno,
}: {
  items: ItemPedido[];
  fecha: string;
  turno: string;
}) {
  const mensaje = armarMensajePedido(items, fecha, turno);
  return (
    <div className="flex flex-col gap-2">
      <pre className="whitespace-pre-wrap rounded-lg bg-zinc-100 p-3 text-xs leading-relaxed">
        {mensaje}
      </pre>
      <a
        href={whatsappUrl(mensaje)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-12 items-center justify-center rounded-lg bg-[#25D366] font-semibold text-white"
      >
        Enviar por WhatsApp
      </a>
    </div>
  );
}
