"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { guardarConteo } from "@/app/conteo/actions";
import { guardarPedido } from "@/app/pedidos/actions";
import { StockInput } from "@/components/conteo/StockInput";
import { ProgressBar } from "@/components/ProgressBar";
import { cantidadSugerida } from "@/lib/calculations";
import { parsearCantidad } from "@/lib/quantity-parse";
import { displayDate } from "@/lib/dates";
import type { DetalleConteo, InventoryCatalog, InventoryRecord, Location } from "@/lib/types";

type Row = { stock: string; pedido: string; manual: boolean };
type Draft = { version: 1; serverVersion: string | null; rows: Record<string, Row>; notes: string; savedAt: string };
const rowKey = (product: string, location: Location) => `${product}:${location}`;

export function DailyCountClient({ catalog, date, userId, responsible, initial }: {
  catalog: InventoryCatalog; date: string; userId: string; responsible: string;
  initial: { inventory: InventoryRecord | null; details: DetalleConteo[] };
}) {
  const router = useRouter();
  const cerrado = initial.inventory?.estado === "CERRADO";
  const beverages = catalog.sheet.modo === "STOCK_UBICACIONES";
  const locations: Location[] = beverages ? ["DEPOSITO", "HELADERA"] : ["GENERAL"];
  const [rows, setRows] = useState<Record<string, Row>>(() => Object.fromEntries(initial.details.map(d => [
    rowKey(d.producto_id, d.ubicacion), { stock: d.stock_real === null ? "" : String(d.stock_real),
      pedido: d.cantidad_pedida === null ? "" : String(d.cantidad_pedida), manual: d.es_ajuste_manual },
  ])));
  const [notes, setNotes] = useState(initial.inventory?.observaciones ?? "");
  const [dirty, setDirty] = useState<Record<string, Row>>({});
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingDraft, setPendingDraft] = useState<Draft | null>(null);
  const [open, setOpen] = useState(catalog.sections[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const storageKey = `hipolito:v2:${userId}:${catalog.sheet.id}:${date}`;
  const serverVersion = useRef(initial.inventory?.actualizado_en ?? null);
  const savedNotes = useRef(initial.inventory?.observaciones ?? "");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const draft: Draft = JSON.parse(raw);
        if (draft.version === 1 && draft.rows && typeof draft.notes === "string" && Object.entries(draft.rows).every(([key, row]) =>
          catalog.products.some(product => locations.some(location => key === rowKey(product.id, location))) &&
          typeof row?.stock === "string" && typeof row?.pedido === "string" && typeof row?.manual === "boolean")) {
          startTransition(() => setPendingDraft(draft));
        }
      }
    } catch { /* A corrupt backup must never block the count. */ }
    startTransition(() => setReady(true));
    // The component is keyed by user, inventory and date; restore only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!ready || pendingDraft || (!Object.keys(dirty).length && notes === savedNotes.current)) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: 1, serverVersion: serverVersion.current,
        rows: dirty, notes, savedAt: new Date().toISOString() } satisfies Draft));
    } catch { /* The server remains the primary persistence layer. */ }
  }, [dirty, notes, storageKey, ready, pendingDraft, initial.inventory?.observaciones]);

  const current = (id: string, location: Location): Row => rows[rowKey(id, location)] ?? { stock: "", pedido: "", manual: false };
  const complete = (id: string) => locations.every(location => {
    const value = current(id, location).stock;
    return value.trim() !== "" && parsearCantidad(value) !== null;
  });
  const counted = catalog.products.filter(p => complete(p.id)).length;
  const update = (id: string, location: Location, change: Partial<Row>) => {
    const key = rowKey(id, location);
    const next = { ...current(id, location), ...change };
    setRows(previous => ({ ...previous, [key]: next }));
    setDirty(previous => ({ ...previous, [key]: next }));
    setMessage("");
  };

  const save = async (order = false) => {
    if (pendingDraft || saving) return;
    const details: DetalleConteo[] = [];
    for (const [key, row] of Object.entries(dirty)) {
      const [product, location] = key.split(":") as [string, Location];
      const stock = parsearCantidad(row.stock);
      const pedido = parsearCantidad(row.pedido);
      if ((row.stock.trim() && stock === null) || (row.pedido.trim() && pedido === null)) {
        setMessage("Hay cantidades no válidas. Corrige los campos marcados antes de guardar."); return;
      }
      details.push({ producto_id: product, ubicacion: location, stock_real: stock,
        cantidad_pedida: pedido, es_ajuste_manual: row.manual });
    }
    setSaving(true);
    setMessage("");
    try {
      const result = await guardarConteo({ sheetId: catalog.sheet.id, date, details, notes });
      if (!result.ok || !result.id) { setMessage(result.error ?? "No se pudo guardar."); return; }
      setDirty({});
      savedNotes.current = notes;
      if (result.version) serverVersion.current = result.version;
      try { localStorage.removeItem(storageKey); } catch { /* Optional backup. */ }
      setMessage("Inventario guardado. Puedes continuar completándolo durante el día.");
      if (order) {
        const created = await guardarPedido(result.id);
        if (!created.ok) { setMessage(created.error ?? "El conteo se guardó, pero no se pudo crear el pedido."); return; }
        router.push(`/pedidos?pedido=${created.id}`);
      } else {
        router.refresh();
      }
    } catch { setMessage("No se pudo conectar. Los cambios siguen en este dispositivo; vuelve a intentar."); }
    finally { setSaving(false); }
  };

  return <div className="space-y-4 pb-28">
    <header className="panel">
      <p className="eyebrow">Inventario diario · {displayDate(date)}</p>
      <h1>{catalog.sheet.nombre}</h1>
      <p className="text-sm text-zinc-600">{responsible} · Una planilla por día, sin turnos.</p>
      <p className="mt-3 font-semibold tabular-nums">{counted} de {catalog.products.length} artículos completos</p>
      <ProgressBar value={counted} max={catalog.products.length} label="Progreso del inventario" />
    </header>
    {pendingDraft && <section className="panel border-amber-400 bg-amber-50" aria-label="Borrador disponible">
      <h2>Hay cambios sin guardar en este dispositivo</h2>
      <p className="my-2 text-sm">{pendingDraft.serverVersion !== (initial.inventory?.actualizado_en ?? null)
        ? "El servidor cambió desde que se creó el borrador. Revisa los valores al recuperarlo."
        : "Puedes recuperarlos o continuar con los datos del servidor."}</p>
      <div className="flex flex-wrap gap-2">
        <button className="button-primary" onClick={() => {
          setRows(previous => ({ ...previous, ...pendingDraft.rows })); setDirty(pendingDraft.rows);
          setNotes(pendingDraft.notes); setPendingDraft(null);
        }}>Recuperar borrador</button>
        <button className="button-secondary" onClick={() => {
          try { localStorage.removeItem(storageKey); } catch { /* Optional backup. */ }
          setPendingDraft(null);
        }}>Usar datos del servidor</button>
      </div>
    </section>}
    <label className="block"><span className="sr-only">Buscar artículo</span>
      <input className="field" placeholder="Buscar artículo en esta planilla…" value={search} onChange={e => setSearch(e.target.value)} />
    </label>
    <label className="flex min-h-12 items-center gap-3 text-sm font-medium">
      <input type="checkbox" className="size-5 accent-emerald-700" checked={pendingOnly} onChange={e => setPendingOnly(e.target.checked)} />Mostrar sólo pendientes
    </label>
    <fieldset disabled={saving || !ready || !!pendingDraft || cerrado} className="space-y-3 disabled:opacity-60">
      {catalog.sections.map(section => {
        const products = catalog.products.filter(p => p.seccion_id === section.id);
        const visible = products.filter(p => p.nombre.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")) && (!pendingOnly || !complete(p.id)));
        if (!visible.length) return null;
        const expanded = search !== "" || open === section.id;
        return <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white" key={section.id}>
          <button type="button" className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left font-semibold"
            aria-expanded={expanded} aria-controls={`section-${section.id}`} onClick={() => setOpen(expanded ? "" : section.id)}>
            {section.nombre}<span className="text-sm tabular-nums text-zinc-600">{products.filter(p => complete(p.id)).length}/{products.length} {expanded ? "−" : "+"}</span>
          </button>
          {expanded && <div className="divide-y divide-zinc-100 border-t border-zinc-100 px-4" id={`section-${section.id}`}>
            {visible.map(product => {
              const row = current(product.id, "GENERAL");
              const suggested = product.objetivo_confirmado && product.stock_ideal !== null && parsearCantidad(row.stock) !== null
                ? cantidadSugerida(product.stock_ideal, parsearCantidad(row.stock)) : null;
              const total = locations.map(location => parsearCantidad(current(product.id, location).stock));
              return <article key={product.id} className="py-4">
                <h3 className="font-semibold">{product.nombre} {product.presentacion && <span className="font-normal text-zinc-600">· {product.presentacion}</span>}</h3>
                <p className="mb-3 text-xs text-zinc-600">{product.unidad_medida === "POR_DEFINIR" ? "Unidad pendiente de configuración" : product.unidad_medida}
                  {!beverages && (suggested === null ? " · Pedido manual" : ` · Pedido sugerido: ${suggested}`)}</p>
                <div className="flex gap-3">
                  {locations.map(location => <StockInput key={location} label={location === "GENERAL" ? "Stock" : location === "DEPOSITO" ? "Depósito" : "Heladera"}
                    value={current(product.id, location).stock} onChange={stock => update(product.id, location, { stock })} />)}
                  {!beverages && <StockInput label="Pedir" value={row.manual ? row.pedido : suggested === null ? "" : String(suggested)}
                    onChange={pedido => update(product.id, "GENERAL", { pedido, manual: true })} />}
                </div>
                {!beverages && row.manual && suggested !== null && <button className="mt-2 min-h-12 text-sm font-medium text-emerald-800"
                  onClick={() => update(product.id, "GENERAL", { manual: false, pedido: "" })}>Usar sugerido: {suggested}</button>}
                {beverages && <p className="mt-2 text-sm tabular-nums">Total: {total.every(n => n !== null) ? total.reduce<number>((sum, n) => sum + (n ?? 0), 0) : "Pendiente"}</p>}
              </article>;
            })}
          </div>}
        </section>;
      })}
      <label className="panel block"><span className="mb-2 block font-semibold">Observaciones generales</span>
        <textarea className="field min-h-24" maxLength={4000} value={notes} onChange={e => setNotes(e.target.value)} />
      </label>
    </fieldset>
    <div className="action-bar">
      <p role="status" className="mb-2 text-sm">{message || (Object.keys(dirty).length ? "Hay cambios pendientes de guardar" : "Puedes guardar y retomar en cualquier momento")}</p>
      <div className="flex gap-2">
        <button className="button-primary flex-1" disabled={saving || !ready || !!pendingDraft || cerrado} onClick={() => save()}>{saving ? "Guardando…" : "Guardar inventario"}</button>
        {!beverages && <button className="button-secondary flex-1" disabled={saving || !!pendingDraft || !ready || counted === 0 || cerrado} onClick={() => save(true)}>Generar pedido</button>}
      </div>
    </div>
  </div>;
}
