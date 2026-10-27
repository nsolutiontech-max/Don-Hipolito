import type { Rol, SheetCode } from "./types";

export function canOperate(role: Rol): boolean {
  return role === "DUEÑO" || role === "ENCARGADO";
}

export function canAccessSheet(role: Rol, code: SheetCode): boolean {
  return canOperate(role) || (role === "CAMARERO" && code === "BEBIDAS");
}

export function sheetSlug(code: SheetCode): string {
  return code.toLowerCase().replaceAll("_", "-");
}

export function parseSheetCode(slug: string): SheetCode | null {
  const code = slug.toUpperCase().replaceAll("-", "_");
  return ["STOCK_A", "STOCK_B", "STOCK_C", "BEBIDAS"].includes(code) ? code as SheetCode : null;
}
