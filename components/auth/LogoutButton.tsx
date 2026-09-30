"use client";

import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await supabaseBrowser().auth.signOut();
        router.replace("/login");
        router.refresh();
      }}
      className="rounded px-2 py-1 hover:bg-emerald-700"
    >
      Salir
    </button>
  );
}
