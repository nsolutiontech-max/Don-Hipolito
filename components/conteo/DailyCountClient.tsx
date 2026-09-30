"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CountHeader } from "@/components/conteo/CountHeader";
import { CategoryAccordion } from "@/components/conteo/CategoryAccordion";
import { StickySummaryBar } from "@/components/conteo/StickySummaryBar";
import { cargarDetalles, guardarConteo } from "@/app/conteo/actions";
import { cantidadSugerida } from "@/lib/calculations";
import type {
  Catalogo,
  DetalleConteo,
  Producto,
  Turno,
} from "@/lib/data";

type Props = {
  fecha: string;
  catalogo: Catalogo;
  detallesIniciales: DetalleConteo[];
  responsableId: string;
  responsableNombre: string;
};

function mapaInicial(productos: Producto[], previos: DetalleConteo[]) {
  const m = new Map<string, DetalleConteo>();
  const porId = new Map(previos.map((d) => [d.producto_id, d]));
  for (const p of productos) {
    m.set(
      p.id,
      porId.get(p.id) ?? {
        producto_id: p.id,
        stock_real: null,
        cantidad_pedida: null,
        cantidad_sugerida: 0,
        es_ajuste_manual: false,
      },
    );
  }
  return m;
}

export function DailyCountClient({
  fecha,
  catalogo,
  detallesIniciales,
  responsableId,
  responsableNombre,
}: Props) {
  const router = useRouter();
  const [turno, setTurno] = useState<Turno>("NOCHE");
  const [abierta, setAbierta] = useState<string | null>(catalogo.categorias[0]?.id ?? null);
  const [detalles, setDetalles] = useState(() => mapaInicial(catalogo.productos, detallesIniciales));
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const claveBorrador = `hipolito-conteo-${fecha}-${turno}`;

  // Carga por turno: servidor + borrador local encima (el borrador gana).
  useEffect(() => {
    let vivo = true;
    (async () => {
      let servidor: DetalleConteo[] = [];
      try {
        servidor = await cargarDetalles(fecha, turno);
      } catch {
        servidor = [];
      }
      let borrador: { detalles: DetalleConteo[] } | null = null;
      try {
        const raw = localStorage.getItem(claveBorrador);
        if (raw) borrador = JSON.parse(raw);
      } catch {
        borrador = null;
      }
      if (!vivo) return;
      const base = new Map(servidor.map((d) => [d.producto_id, d]));
      // El borrador local gana donde haya conteo (protege ediciones sin guardar)
      for (const d of borrador?.detalles ?? []) {
        if (d.stock_real !== null) base.set(d.producto_id, d);
      }
      setDetalles(mapaInicial(catalogo.productos, [...base.values()]));
    })();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveBorrador]);

  useEffect(() => {
    try {
      localStorage.setItem(
        claveBorrador,
        JSON.stringify({ detalles: [...detalles.values()] }),
      );
    } catch {
      // almacenamiento lleno o bloqueado: el guardado principal sigue funcionando
    }
  }, [claveBorrador, detalles]);

  const porCategoria = useMemo(() => {
    const m = new Map<string, Producto[]>();
    for (const p of catalogo.productos) {
      const lista = m.get(p.categoria_id) ?? [];
      lista.push(p);
      m.set(p.categoria_id, lista);
    }
    return m;
  }, [catalogo.productos]);

  const contados = useMemo(
    () => [...detalles.values()].filter((d) => d.stock_real !== null).length,
    [detalles],
  );

  const actualizar = (productoId: string, parche: Partial<DetalleConteo>) => {
    setDetalles((prev) => {
      const next = new Map(prev);
      next.set(productoId, { ...next.get(productoId)!, ...parche });
      return next;
    });
  };

  const onStock = (productoId: string, valor: number | null) => {
    const prod = catalogo.productos.find((p) => p.id === productoId)!;
    const actual = detalles.get(productoId)!;
    const sugerida = cantidadSugerida(prod.stock_ideal, valor);
    actualizar(productoId, {
      stock_real: valor,
      cantidad_sugerida: sugerida,
      // Si no había ajuste manual, el pedido sigue al sugerido
      cantidad_pedida: actual.es_ajuste_manual ? actual.cantidad_pedida : sugerida,
    });
  };

  const onPedido = (productoId: string, valor: number | null) => {
    const actual = detalles.get(productoId)!;
    actualizar(productoId, {
      cantidad_pedida: valor,
      es_ajuste_manual: valor !== actual.cantidad_sugerida,
    });
  };

  const onGuardar = async () => {
    setGuardando(true);
    setAviso(null);
    const r = await guardarConteo(fecha, turno, [...detalles.values()]);
    setAviso(r.ok ? "Conteo guardado ✓" : `Error: ${r.error}`);
    setGuardando(false);
  };

  const onGenerarPedido = () => {
    const items = [...detalles.values()].filter(
      (d) => (d.cantidad_pedida ?? d.cantidad_sugerida) > 0,
    );
    try {
      localStorage.setItem(
        "hipolito-ultimo-pedido",
        JSON.stringify({ fecha, turno, responsableId, items }),
      );
    } catch {
      // sin almacenamiento: igual navegamos, la página de pedidos avisará
    }
    router.push("/pedidos");
  };

  return (
    <div className="flex flex-col gap-3 pb-4">
      <CountHeader
        fecha={fecha}
        turno={turno}
        responsableNombre={responsableNombre}
        onTurno={setTurno}
      />
      {aviso && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{aviso}</p>
      )}
      {catalogo.categorias.map((c) => (
        <CategoryAccordion
          key={c.id}
          categoria={c}
          productos={porCategoria.get(c.id) ?? []}
          detalles={detalles}
          abierto={abierta === c.id}
          onToggle={() => setAbierta(abierta === c.id ? null : c.id)}
          onStock={onStock}
          onPedido={onPedido}
        />
      ))}
      <StickySummaryBar
        contados={contados}
        total={catalogo.productos.length}
        guardando={guardando}
        puedeGuardar={contados > 0}
        onGuardar={onGuardar}
        onGenerarPedido={onGenerarPedido}
      />
    </div>
  );
}
