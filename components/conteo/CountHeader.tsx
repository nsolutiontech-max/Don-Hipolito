"use client";

import type { Turno } from "@/lib/data";

type Props = {
  fecha: string;
  turno: Turno;
  responsableNombre: string;
  onTurno: (t: Turno) => void;
};

/** El responsable sale de la sesión: nadie puede cargar a nombre de otro. */
export function CountHeader({ fecha, turno, responsableNombre, onTurno }: Props) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <p className="text-sm text-zinc-500">
        Conteo del <span className="font-semibold text-zinc-900">{fecha}</span>
      </p>
      <p className="mt-1 text-sm">
        Responsable: <span className="font-semibold text-zinc-900">{responsableNombre}</span>
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
    </div>
  );
}
