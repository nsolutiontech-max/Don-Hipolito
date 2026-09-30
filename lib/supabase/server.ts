import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const supabaseConfigurado =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function exigirConfig() {
  if (!supabaseConfigurado) {
    throw new Error("Falta configuración de Supabase (.env.local / Vercel env).");
  }
}

// Cliente de servidor con sesión por cookies. Usar en Server Components,
// Server Actions y Route Handlers. Nunca exponer la service_role aquí.
export async function supabaseServer() {
  exigirConfig();
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (lista) => {
          try {
            lista.forEach(({ name, value, options }) =>
              store.set(name, value, options),
            );
          } catch {
            // En Server Components las cookies son solo lectura: se ignora.
          }
        },
      },
    },
  );
}

// Cliente con service_role. SOLO servidor, SOLO admin (gestión de usuarios).
// Jamás importarlo en componentes cliente ni exponer su resultado.
export async function supabaseAdmin() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.");
  }
  return createClient(url, secret);
}
