import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppNavigation } from "@/components/AppNavigation";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { getSesionUsuario } from "@/lib/data";

export const metadata: Metadata = {
  title: "Don Hipólito · Operaciones", description: "Inventarios y tareas diarias del restaurante",
  manifest: "/manifest.webmanifest", appleWebApp: { capable: true, title: "Don Hipólito", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#065f46", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSesionUsuario();
  return <html lang="es" className="h-full"><body className="min-h-full font-sans antialiased">
    {session ? <>
      <a className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-white focus:p-3" href="#main">Ir al contenido</a>
      <aside className="border-b border-zinc-200 bg-white md:fixed md:inset-y-0 md:left-0 md:w-60 md:border-r">
        <div className="flex items-center justify-between px-4 py-4 md:block md:p-6">
          <div className="shrink-0"><p className="whitespace-nowrap text-lg font-bold text-emerald-900">Don Hipólito</p><p className="text-xs text-zinc-600">Operaciones diarias</p></div>
          <div className="min-w-0 max-w-[55%] pl-3 text-right md:mt-6 md:max-w-none md:pl-0 md:text-left"><p className="truncate text-sm font-medium" title={session.responsable_nombre ?? session.email}>{session.responsable_nombre ?? session.email}</p>
            <p className="text-xs text-zinc-500">{session.rol === "DUEÑO" ? "Dueño" : session.rol === "CAMARERO" ? "Camarero" : "Encargado"}</p></div>
        </div>
        <div className="md:px-3"><AppNavigation /></div>
        <div className="hidden px-6 py-4 md:block"><LogoutButton /></div>
      </aside>
      <main id="main" className="mx-auto max-w-5xl px-4 py-5 md:ml-60 md:px-8 md:py-8">{children}</main>
    </> : <main id="main" className="mx-auto max-w-lg px-4 py-8">{children}</main>}
  </body></html>;
}
