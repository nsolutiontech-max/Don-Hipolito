"use client";

import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        const { error } = await supabaseBrowser().auth.signOut();
        if (error) return;
        try {
          for (const key of Object.keys(localStorage)) {
            if (key.startsWith("hipolito")) localStorage.removeItem(key);
          }
        } catch { /* Browser storage is optional. */ }
        router.replace("/login");
        router.refresh();
      }}
      className="button-secondary"
    >
      Salir
    </button>
  );
}
