"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onEntrar = async () => {
    if (!email.trim() || !password) {
      setError("Completá email y contraseña.");
      return;
    }
    setEntrando(true);
    setError(null);
    const db = supabaseBrowser();
    const { error } = await db.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setError("Email o contraseña incorrectos.");
      setEntrando(false);
      return;
    }
    router.replace("/conteo/hoy");
    router.refresh();
  };

  return (
    <div className="mx-auto mt-10 w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6">
      <h1 className="text-xl font-bold">Don Hipólito · Stock</h1>
      <p className="mt-1 text-sm text-zinc-500">Acceso del equipo (cocina y dueño).</p>
      <label className="mt-4 flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-500">Email</span>
        <input
          type="email"
          autoComplete="username"
          placeholder="nico@donhipolito.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onEntrar();
          }}
          className="h-12 rounded-lg border border-zinc-300 px-3 text-base text-zinc-900 placeholder:text-zinc-400"
        />
      </label>
      <label className="mt-3 flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-500">Contraseña</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onEntrar();
          }}
          className="h-12 rounded-lg border border-zinc-300 px-3 text-base text-zinc-900"
        />
      </label>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      <button
        type="button"
        onClick={onEntrar}
        disabled={entrando}
        className="mt-4 h-12 w-full rounded-lg bg-emerald-700 font-semibold text-white disabled:opacity-40"
      >
        {entrando ? "Entrando…" : "Entrar"}
      </button>
    </div>
  );
}
