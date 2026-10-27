import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { fechaHoy, pageSession } from "@/lib/data";
import { displayDate } from "@/lib/dates";
import { getTasks } from "@/lib/tasks";
import { TaskList } from "@/components/TaskList";

export default async function TaskPage({ params }: { params: Promise<{ area: string; fecha: string }> }) {
  const session = await pageSession();
  const path = await params;
  if (!["cocina", "salon"].includes(path.area)) notFound();
  if (session.rol === "CAMARERO" && path.area !== "salon") redirect("/tareas");
  const date = path.fecha === "hoy" ? fechaHoy() : path.fecha;
  if (!z.iso.date().safeParse(date).success) notFound();
  const area = path.area === "cocina" ? "COCINA" : "SALON";
  const data = await getTasks(area, date);
  return <div className="space-y-4"><Link className="button-secondary" href={`/tareas?fecha=${date}`}>← Todas las tareas</Link>
    <header><p className="eyebrow">{displayDate(date)}</p><h1>{area === "COCINA" ? "Tareas Cocina Check" : "Tareas Salón Check"}</h1>
      <p className="mt-2 text-sm text-zinc-600">{session.responsable_nombre ?? session.email} · El mismo registro diario se puede completar a cualquier hora.</p></header>
    <TaskList key={`${area}:${date}`} tasks={data.tasks} records={data.records} date={date} />
  </div>;
}
