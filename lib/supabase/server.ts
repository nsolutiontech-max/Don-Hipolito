import { createClient } from "@supabase/supabase-js";

// Cliente de servidor para el MVP (sin Auth: usa la anon key, igual que el browser).
// Cuando se agregue login, migrar a @supabase/ssr con cookies.
export function supabaseServer() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export const supabaseConfigurado =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
