"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { sumarDias } from "@/lib/dates";

export function DateNavigation({ basePath, date, today, mostrarHistorial = true, titulo = "Fecha de la planilla" }: {
  basePath: string; date: string; today: string; mostrarHistorial?: boolean; titulo?: string;
}) {
  const router = useRouter();
  const previous = sumarDias(date, -1);
  const next = sumarDias(date, 1);
  return <nav className="panel space-y-3" aria-label="Navegación por fecha">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <p className="eyebrow mb-0">{titulo}</p>
      {date !== today && <Link className="text-sm font-semibold text-emerald-800 underline" href={`${basePath}/${today}`}>Volver a hoy</Link>}
    </div>
    <div className="flex gap-2">
      <Link className="button-secondary flex-1" href={`${basePath}/${previous}`}>← Día anterior</Link>
      {next <= today
        ? <Link className="button-secondary flex-1" href={`${basePath}/${next}`}>Día siguiente →</Link>
        : <span className="button-secondary flex-1 opacity-50" aria-disabled="true">Día siguiente →</span>}
    </div>
    <label className="block"><span className="mb-1 block text-sm font-medium">Ir a una fecha</span>
      <input className="field" type="date" value={date} max={today}
        onChange={event => { if (event.target.value) router.push(`${basePath}/${event.target.value}`); }} /></label>
    {mostrarHistorial && <Link className="button-secondary w-full" href={basePath}>Ver historial de la planilla</Link>}
  </nav>;
}
