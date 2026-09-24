import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hipólito · Control de Stock",
  description: "Conteo diario de insumos del restaurante",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Hipólito Stock", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#047857",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const NAV = [
  { href: "/conteo/hoy", label: "Conteo" },
  { href: "/movimientos", label: "Movimientos" },
  { href: "/pedidos", label: "Pedidos" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full bg-zinc-100 font-sans text-zinc-900 antialiased">
        <header className="sticky top-0 z-10 bg-emerald-800 text-white">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
            <span className="text-lg font-bold">Hipólito · Stock</span>
            <nav className="flex gap-1 text-sm font-medium">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="rounded px-2 py-1 hover:bg-emerald-700">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-4">{children}</main>
      </body>
    </html>
  );
}
