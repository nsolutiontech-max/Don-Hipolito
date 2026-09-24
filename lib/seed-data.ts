import type {
  Categoria,
  Producto,
  Responsable,
} from "@/lib/data";

/**
 * Catálogo de respaldo: mismos datos que supabase/seed.sql.
 * Se usa cuando Supabase todavía no está configurado (.env.local vacío),
 * para poder probar el frontend sin base de datos.
 */

export const CATEGORIAS_FALLBACK: Categoria[] = [
  { id: "verduleria", nombre: "Verdulería", orden: 1 },
  { id: "aceites", nombre: "Aceites", orden: 2 },
  { id: "frutos-secos", nombre: "Frutos Secos", orden: 3 },
  { id: "especias", nombre: "Especias", orden: 4 },
  { id: "masa", nombre: "Masa", orden: 5 },
  { id: "harinas", nombre: "Harinas", orden: 6 },
];

type Fila = [categoria: string, nombre: string, unidad: string, min: number, ideal: number];

const FILAS: Fila[] = [
  ["verduleria", "Tomate Redondo", "KG", 3, 8],
  ["verduleria", "Tomate Cherry", "KG", 1, 3],
  ["verduleria", "Cebolla Común", "KG", 3, 8],
  ["verduleria", "Cebolla Morada", "KG", 2, 5],
  ["verduleria", "Cebolla de Verdeo", "ATADO", 3, 8],
  ["verduleria", "Ajo", "KG", 0.5, 2],
  ["verduleria", "Lechuga", "UN", 4, 12],
  ["verduleria", "Rúcula", "ATADO", 3, 8],
  ["verduleria", "Limón", "KG", 2, 5],
  ["verduleria", "Morrón", "KG", 2, 5],
  ["verduleria", "Albahaca", "ATADO", 2, 6],
  ["verduleria", "Laurel", "PAQ", 1, 2],
  ["verduleria", "Perejil", "ATADO", 3, 8],
  ["verduleria", "Choclo", "UN", 6, 20],
  ["verduleria", "Chaucha", "KG", 1, 3],
  ["verduleria", "Zapallo Anco", "KG", 3, 8],
  ["verduleria", "Zapallo Cabutiá", "KG", 3, 8],
  ["verduleria", "Zanahoria", "KG", 2, 5],
  ["verduleria", "Berenjena", "KG", 2, 5],
  ["verduleria", "Remolacha", "KG", 1, 3],
  ["verduleria", "Papa", "KG", 5, 15],
  ["verduleria", "Batata", "KG", 3, 8],
  ["verduleria", "Puerro", "ATADO", 2, 6],
  ["verduleria", "Espinaca", "ATADO", 3, 8],
  ["verduleria", "Zucchini", "KG", 2, 5],
  ["verduleria", "Palta", "UN", 4, 12],
  ["aceites", "Aceite de Girasol", "LT", 5, 20],
  ["aceites", "Aceite de Oliva", "LT", 1, 5],
  ["aceites", "Aceite de Freidora", "LT", 5, 20],
  ["aceites", "Grasa", "KG", 1, 5],
  ["aceites", "Huevos", "UN", 30, 120],
  ["frutos-secos", "Maní", "KG", 1, 3],
  ["frutos-secos", "Almendra", "KG", 0.5, 2],
  ["frutos-secos", "Nueces", "KG", 0.5, 2],
  ["frutos-secos", "Castañas", "KG", 0.5, 2],
  ["especias", "Orégano", "PAQ", 2, 5],
  ["especias", "Ají Molido", "PAQ", 1, 3],
  ["especias", "Pimentón", "PAQ", 1, 3],
  ["especias", "Pimentón Ahumado", "PAQ", 1, 2],
  ["especias", "Nuez Moscada", "UN", 2, 6],
  ["especias", "Comino", "PAQ", 1, 2],
  ["especias", "Peperoncino", "PAQ", 1, 2],
  ["especias", "Pimienta Negra", "PAQ", 1, 3],
  ["especias", "Pimienta Blanca", "PAQ", 1, 2],
  ["especias", "Mix de Pimientas", "PAQ", 1, 2],
  ["especias", "Sal Fina", "KG", 2, 5],
  ["especias", "Sal Gruesa", "KG", 2, 5],
  ["especias", "Hongos de Pino", "PAQ", 1, 2],
  ["especias", "Tapas de Empanada", "UN", 24, 120],
  ["masa", "Bloques", "UN", 5, 20],
  ["masa", "Bollos", "UN", 10, 40],
  ["masa", "Tapas", "UN", 10, 40],
  ["harinas", "Harina 3C", "KG", 5, 25],
  ["harinas", "Harina Integral", "KG", 2, 10],
  ["harinas", "Sémola", "KG", 1, 5],
  ["harinas", "Harina de Trigo", "KG", 5, 25],
  ["harinas", "Pan Rallado", "KG", 1, 5],
];

export const PRODUCTOS_FALLBACK: Producto[] = FILAS.map(
  ([categoria_id, nombre, unidad_medida, stock_minimo, stock_ideal], i) => ({
    id: `prod-${i + 1}`,
    categoria_id,
    nombre,
    unidad_medida,
    stock_minimo,
    stock_ideal,
  }),
);

export const RESPONSABLES_FALLBACK: Responsable[] = [
  { id: "resp-1", nombre: "Nadia" },
  { id: "resp-2", nombre: "Maru" },
  { id: "resp-3", nombre: "Cocina" },
];
