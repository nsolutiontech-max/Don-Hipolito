import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { pageSession } from "@/lib/data";
import { getAudit, getAuditTemplate } from "@/lib/audits";
import { AuditClient } from "@/components/audits/AuditClient";

export default async function AuditPage({ params }: { params: Promise<{ fecha: string }> }) {
  const session = await pageSession();
  if (session.rol !== "DUEÑO") redirect("/hoy");
  const path = await params;
  if (!z.iso.date().safeParse(path.fecha).success) notFound();
  const [template, record] = await Promise.all([getAuditTemplate(), getAudit(path.fecha)]);
  return <div className="space-y-4">
    <Link className="button-secondary" href="/auditorias">← Historial de auditorías</Link>
    <AuditClient key={record.audit?.id ?? path.fecha}
      date={path.fecha} auditorName={session.responsable_nombre ?? session.email}
      audit={record.audit} parts={record.parts} responses={record.responses} criteria={template.items} />
  </div>;
}
