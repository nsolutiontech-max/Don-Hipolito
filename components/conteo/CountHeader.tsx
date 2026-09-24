"use client";

import type { Responsable, Turno } from "@/lib/data";

type Props = {
  fecha: string;
  turno: Turno;
  responsableId: string | null;
  responsables: Responsable[];
  onTurno: (t: Turno) => void;
  onResponsable: (id: string) => void;
};

export function CountHeader({
  fecha,
  turno,
  responsableId,
  responsables,
  onTurno,
  onResponsable,
}: Props) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <p className="text-sm text-zinc-500">
        Conteo del <span className="font-semibold text-zinc-900">{fecha}</span>
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(["MEDIODIA", "NOCHE"] as Turno[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTurno(t)}
            className={`h-11 rounded-lg text-sm font-semibold ${
              turno === t
                ? "bg-emerald-700 text-white"
                : "bg-zinc-100 text-zinc-700"
            }`}
          >
            {t === "MEDIODIA" ? "Mediodía" : "Noche"}
          </button>
        ))}
      </div>
      <label className="mt-3 flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-500">Responsable del turno</span>
        <select
          value={responsableId ?? ""}
          onChange={(e) => onResponsable(e.target.value)}
          className="h-12 rounded-lg border border-zinc-300 bg-white px-3 text-base"
        >
          <option value="" disabled>
            Elegir responsable…
          </option>
          {responsables.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nombre}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
