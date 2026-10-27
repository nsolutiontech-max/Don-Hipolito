"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppNavigation() {
  const path = usePathname();
  const links = [{ href: "/hoy", label: "Hoy", icon: "◷" }, { href: "/stock", label: "Stock", icon: "▤" },
    { href: "/tareas", label: "Tareas", icon: "✓" }, { href: "/mas", label: "Más", icon: "···" }];
  return <nav aria-label="Navegación principal" className="fixed inset-x-0 bottom-0 z-30 flex min-h-16 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] md:static md:flex-col md:gap-2 md:border-0 md:bg-transparent md:p-0">
    {links.map(link => {
      const active = path.startsWith(link.href) || (link.href === "/stock" && path.startsWith("/conteo"));
      return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined}
        className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-1 px-2 text-xs font-semibold md:min-h-12 md:flex-row md:justify-start md:gap-3 md:rounded-lg md:px-4 md:text-sm ${active ? "bg-emerald-50 text-emerald-900" : "text-zinc-600 hover:bg-zinc-100"}`}>
        <span aria-hidden="true" className="text-xl leading-none">{link.icon}</span>{link.label}
      </Link>;
    })}
  </nav>;
}
