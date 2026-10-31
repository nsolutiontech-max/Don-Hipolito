export type Rol = "DUEÑO" | "ENCARGADO" | "CAMARERO";
export type SheetCode = "STOCK_A" | "STOCK_B" | "STOCK_C" | "BEBIDAS";
export type Location = "GENERAL" | "DEPOSITO" | "HELADERA";
export type Categoria = { id: string; nombre: string; orden: number };
export type Producto = {
  id: string; categoria_id: string; nombre: string; presentacion: string;
  unidad_medida: string; stock_minimo: number; stock_ideal: number | null; objetivo_confirmado: boolean;
  activo: boolean;
};
export type Responsable = { id: string; nombre: string };
export type Proveedor = { id: string; nombre: string; telefono: string | null; activo: boolean };
export type Compra = {
  id: string; producto_id: string; proveedor_id: string | null; fecha: string;
  cantidad: number; unidad_medida: string; precio_unitario: number;
  responsable_id: string | null; movimiento_id: string | null;
};
export type DetalleConteo = {
  producto_id: string; ubicacion: Location; stock_real: number | null;
  cantidad_pedida: number | null; cantidad_sugerida?: number | null; es_ajuste_manual: boolean;
};
export type TipoMovimiento = "INGRESO" | "EGRESO";
export type Movimiento = {
  id: string; producto_id: string; tipo: TipoMovimiento; cantidad: number;
  motivo: string; fecha: string; responsable_id: string | null;
};
export type SesionUsuario = {
  id: string; email: string; rol: Rol; responsable_id: string | null; responsable_nombre: string | null;
};
export type Catalogo = { categorias: Categoria[]; productos: Producto[]; responsables: Responsable[] };
export type InventorySheet = {
  id: string; codigo: SheetCode; nombre: string; modo: "STOCK_PEDIDO" | "STOCK_UBICACIONES"; orden: number;
};
export type InventoryCatalog = {
  sheet: InventorySheet; sections: Categoria[]; products: (Producto & { seccion_id: string; orden: number })[];
};
export type InventoryRecord = {
  id: string; fecha: string; planilla_id: string; observaciones: string; actualizado_en: string;
  estado?: "ABIERTO" | "CERRADO";
  cerrado_por?: string | null; cerrado_en?: string | null; motivo_apertura?: string;
};
export type InventoryHistoryEntry = {
  id: string; fecha: string; estado: "ABIERTO" | "CERRADO";
  actualizado_en: string; completos: number;
};
