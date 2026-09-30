import { supabaseServer } from "@/lib/supabase/server";

// Tipos espejo de las tablas en español (ver supabase/migrations/*.sql)
export type Categoria = { id: string; nombre: string; orden: number };
export type Producto = {
  id: string;
  categoria_id: string;
  nombre: string;
  unidad_medida: string;
  stock_minimo: number;
  stock_ideal: number;
};
export type Responsable = { id: string; nombre: string };
export type DetalleConteo = {
  producto_id: string;
  stock_real: number | null;
  cantidad_pedida: number | null;
  cantidad_sugerida: number;
  es_ajuste_manual: boolean;
};
export type Turno = "MEDIODIA" | "NOCHE";
export type TipoMovimiento = "INGRESO" | "EGRESO";
export type Rol = "DUEÑO" | "ENCARGADO";
export type Movimiento = {
  id: string;
  producto_id: string;
  tipo: TipoMovimiento;
  cantidad: number;
  motivo: string;
  fecha: string;
  responsable_id: string | null;
};
export type SesionUsuario = {
  id: string;
  email: string;
  rol: Rol;
  responsable_id: string | null;
  responsable_nombre: string | null;
};

export type Catalogo = {
  categorias: Categoria[];
  productos: Producto[];
  responsables: Responsable[];
};

/** Sesión + rol desde el servidor. Null si no hay login o el usuario está inactivo. */
export async function getSesionUsuario(): Promise<SesionUsuario | null> {
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user?.email) return null;
  const { data, error } = await db
    .from("usuarios")
    .select("id, email, rol, responsable_id, responsables(nombre)")
    .eq("id", user.id)
    .eq("activo", true)
    .maybeSingle();
  if (error || !data) return null;
  const resp = data.responsables as unknown as { nombre: string } | null;
  return {
    id: data.id as string,
    email: data.email as string,
    rol: data.rol as Rol,
    responsable_id: (data.responsable_id as string | null) ?? null,
    responsable_nombre: resp?.nombre ?? null,
  };
}

export async function exigirSesion(): Promise<SesionUsuario> {
  const s = await getSesionUsuario();
  if (!s) throw new Error("Sesión requerida.");
  return s;
}

export async function exigirDueno(): Promise<SesionUsuario> {
  const s = await exigirSesion();
  if (s.rol !== "DUEÑO") throw new Error("Solo el dueño puede hacer esto.");
  return s;
}

export async function getCatalogo(): Promise<Catalogo> {
  const db = await supabaseServer();
  const [cats, prods, resps] = await Promise.all([
    db.from("categorias").select("id,nombre,orden").order("orden"),
    db.from("productos").select("id,categoria_id,nombre,unidad_medida,stock_minimo,stock_ideal").eq("activo", true),
    db.from("responsables").select("id,nombre").eq("activo", true).order("nombre"),
  ]);
  if (cats.error ?? prods.error ?? resps.error) {
    throw new Error("No se pudo cargar el catálogo desde Supabase.");
  }
  return {
    categorias: cats.data as Categoria[],
    productos: prods.data as Producto[],
    responsables: resps.data as Responsable[],
  };
}

export async function getDetalles(
  fecha: string,
  turno: Turno,
): Promise<DetalleConteo[]> {
  const db = await supabaseServer();
  const { data: inv } = await db
    .from("inventarios")
    .select("id")
    .eq("fecha", fecha)
    .eq("turno", turno)
    .maybeSingle();
  if (!inv) return [];
  const { data, error } = await db
    .from("inventario_detalles")
    .select("producto_id,stock_real,cantidad_pedida,cantidad_sugerida,es_ajuste_manual")
    .eq("inventario_id", inv.id);
  if (error) throw new Error("No se pudieron cargar los detalles del conteo.");
  return data as DetalleConteo[];
}

/** Crea el inventario del día/turno si no existe y devuelve su id. */
export async function getOrCreateInventario(
  fecha: string,
  turno: Turno,
  responsable_id: string | null,
): Promise<string> {
  const db = await supabaseServer();
  const { data: existente } = await db
    .from("inventarios")
    .select("id")
    .eq("fecha", fecha)
    .eq("turno", turno)
    .maybeSingle();
  if (existente) {
    if (responsable_id) {
      await db.from("inventarios").update({ responsable_id }).eq("id", existente.id);
    }
    return existente.id as string;
  }
  const { data, error } = await db
    .from("inventarios")
    .insert({ fecha, turno, responsable_id })
    .select("id")
    .single();
  if (error) throw new Error("No se pudo crear el inventario del día.");
  return data.id as string;
}

export async function guardarDetalles(
  inventario_id: string,
  detalles: DetalleConteo[],
): Promise<void> {
  const db = await supabaseServer();
  const filas = detalles
    .filter((d) => d.stock_real !== null)
    .map((d) => ({
      inventario_id,
      producto_id: d.producto_id,
      stock_real: d.stock_real,
      cantidad_pedida: d.cantidad_pedida ?? d.cantidad_sugerida,
      cantidad_sugerida: d.cantidad_sugerida,
      es_ajuste_manual: d.es_ajuste_manual,
    }));
  if (filas.length === 0) return;
  const { error } = await db.from("inventario_detalles").upsert(filas, {
    onConflict: "inventario_id,producto_id",
  });
  if (error) throw new Error("No se pudo guardar el conteo.");
}

export function fechaHoy(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

export async function getMovimientosRecientes(limite = 20): Promise<Movimiento[]> {
  const db = await supabaseServer();
  const { data, error } = await db
    .from("movimientos")
    .select("id,producto_id,tipo,cantidad,motivo,fecha,responsable_id")
    .order("fecha", { ascending: false })
    .limit(limite);
  if (error) throw new Error("No se pudieron cargar los movimientos.");
  return data as Movimiento[];
}

export async function guardarMovimiento(input: {
  producto_id: string;
  tipo: TipoMovimiento;
  cantidad: number;
  motivo: string;
  responsable_id: string | null;
}): Promise<void> {
  const db = await supabaseServer();
  const { error } = await db.from("movimientos").insert(input);
  if (error) throw new Error("No se pudo guardar el movimiento.");
}

export async function crearPedido(
  fecha: string,
  items: { producto_id: string; cantidad: number }[],
): Promise<string> {
  const db = await supabaseServer();
  const { data: pedido, error } = await db
    .from("pedidos")
    .insert({ fecha, estado: "PENDIENTE" })
    .select("id")
    .single();
  if (error) throw new Error("No se pudo crear el pedido.");
  const { error: errorItems } = await db.from("pedido_items").insert(
    items.map((i) => ({ pedido_id: pedido.id, producto_id: i.producto_id, cantidad: i.cantidad })),
  );
  if (errorItems) throw new Error("No se pudieron guardar los items del pedido.");
  return pedido.id as string;
}
