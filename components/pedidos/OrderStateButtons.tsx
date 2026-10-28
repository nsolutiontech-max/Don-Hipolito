"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cambiarEstadoPedido } from "@/app/pedidos/actions";

export function OrderStateButtons({ id, estado }: { id: string; estado: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const marcar = async (nuevo: "ENVIADO" | "RECIBIDO") => {
    setSaving(true); setError("");
    try {
      const resultado = await cambiarEstadoPedido({ id, estado: nuevo });
      if (!resultado.ok) { setError(resultado.error ?? "No se pudo actualizar el pedido."); return; }
      router.refresh();
    } catch { setError("No se pudo conectar. Volvé a intentar."); }
    finally { setSaving(false); }
  };
  return <div className="mt-3 flex flex-wrap items-center gap-2">
    {estado !== "ENVIADO" && <button className="button-secondary" disabled={saving} onClick={() => marcar("ENVIADO")}>Marcar enviado</button>}
    {estado !== "RECIBIDO" && <button className={estado === "ENVIADO" ? "button-primary" : "button-secondary"} disabled={saving} onClick={() => marcar("RECIBIDO")}>Marcar recibido</button>}
    {error && <p className="text-sm text-red-700">{error}</p>}
  </div>;
}
