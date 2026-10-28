import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { DailyCountClient } from "@/components/conteo/DailyCountClient";
import { CierreControl } from "@/components/conteo/CierreControl";
import { pageSession, getInventoryCatalog, getInventory, fechaHoy } from "@/lib/data";
import { canAccessSheet, parseSheetCode } from "@/lib/permissions";

export default async function InventoryPage({ params }: { params: Promise<{ planilla: string; fecha: string }> }) {
  const session = await pageSession();
  const path = await params;
  const code = parseSheetCode(path.planilla);
  if (!code) notFound();
  if (!canAccessSheet(session.rol, code)) redirect("/hoy");
  const date = path.fecha === "hoy" ? fechaHoy() : path.fecha;
  if (!z.iso.date().safeParse(date).success) notFound();
  const catalog = await getInventoryCatalog(code);
  if (!catalog) notFound();
  const initial = await getInventory(catalog.sheet.id, date);
  return <section className="space-y-4">
    {initial.inventory && <CierreControl id={initial.inventory.id} estado={initial.inventory.estado ?? "ABIERTO"}
      puedeCerrar={session.rol === "DUEÑO" || session.rol === "ENCARGADO"} puedeReabrir={session.rol === "DUEÑO"} cerradoPor={null} />}
    <DailyCountClient key={`${session.id}:${catalog.sheet.id}:${date}`} catalog={catalog} date={date} userId={session.id}
      responsible={session.responsable_nombre ?? session.email} initial={initial} />
  </section>;
}
