-- Hipólito · Seed inicial (productos reales de la planilla en papel)
-- Ejecutar DESPUÉS de 001_schema.sql. Re-ejecutable (upsert por nombre).

-- Categorías
insert into categorias (nombre, orden) values
  ('Verdulería', 1), ('Aceites', 2), ('Frutos Secos', 3),
  ('Especias', 4), ('Masa', 5), ('Harinas', 6)
on conflict (nombre) do nothing;

-- Responsables de ejemplo (ajustar a los nombres reales del equipo)
insert into responsables (nombre) values
  ('Nadia'), ('Maru'), ('Cocina')
on conflict (nombre) do nothing;

-- Productos: (categoria, nombre, unidad, min, ideal)
-- Se usa una tabla temporal para resolver categoria_id por nombre.
create temp table seed_productos (
  categoria text, nombre text, unidad_medida text,
  stock_minimo numeric(10,2), stock_ideal numeric(10,2)
) on commit drop;

insert into seed_productos values
  -- Verdulería
  ('Verdulería','Tomate Redondo','KG',3,8),
  ('Verdulería','Tomate Cherry','KG',1,3),
  ('Verdulería','Cebolla Común','KG',3,8),
  ('Verdulería','Cebolla Morada','KG',2,5),
  ('Verdulería','Cebolla de Verdeo','ATADO',3,8),
  ('Verdulería','Ajo','KG',0.5,2),
  ('Verdulería','Lechuga','UN',4,12),
  ('Verdulería','Rúcula','ATADO',3,8),
  ('Verdulería','Limón','KG',2,5),
  ('Verdulería','Morrón','KG',2,5),
  ('Verdulería','Albahaca','ATADO',2,6),
  ('Verdulería','Laurel','PAQ',1,2),
  ('Verdulería','Perejil','ATADO',3,8),
  ('Verdulería','Choclo','UN',6,20),
  ('Verdulería','Chaucha','KG',1,3),
  ('Verdulería','Zapallo Anco','KG',3,8),
  ('Verdulería','Zapallo Cabutiá','KG',3,8),
  ('Verdulería','Zanahoria','KG',2,5),
  ('Verdulería','Berenjena','KG',2,5),
  ('Verdulería','Remolacha','KG',1,3),
  ('Verdulería','Papa','KG',5,15),
  ('Verdulería','Batata','KG',3,8),
  ('Verdulería','Puerro','ATADO',2,6),
  ('Verdulería','Espinaca','ATADO',3,8),
  ('Verdulería','Zucchini','KG',2,5),
  ('Verdulería','Palta','UN',4,12),
  -- Aceites
  ('Aceites','Aceite de Girasol','LT',5,20),
  ('Aceites','Aceite de Oliva','LT',1,5),
  ('Aceites','Aceite de Freidora','LT',5,20),
  ('Aceites','Grasa','KG',1,5),
  ('Aceites','Huevos','UN',30,120),
  -- Frutos Secos
  ('Frutos Secos','Maní','KG',1,3),
  ('Frutos Secos','Almendra','KG',0.5,2),
  ('Frutos Secos','Nueces','KG',0.5,2),
  ('Frutos Secos','Castañas','KG',0.5,2),
  -- Especias
  ('Especias','Orégano','PAQ',2,5),
  ('Especias','Ají Molido','PAQ',1,3),
  ('Especias','Pimentón','PAQ',1,3),
  ('Especias','Pimentón Ahumado','PAQ',1,2),
  ('Especias','Nuez Moscada','UN',2,6),
  ('Especias','Comino','PAQ',1,2),
  ('Especias','Peperoncino','PAQ',1,2),
  ('Especias','Pimienta Negra','PAQ',1,3),
  ('Especias','Pimienta Blanca','PAQ',1,2),
  ('Especias','Mix de Pimientas','PAQ',1,2),
  ('Especias','Sal Fina','KG',2,5),
  ('Especias','Sal Gruesa','KG',2,5),
  ('Especias','Hongos de Pino','PAQ',1,2),
  ('Especias','Tapas de Empanada','UN',24,120),
  -- Masa
  ('Masa','Bloques','UN',5,20),
  ('Masa','Bollos','UN',10,40),
  ('Masa','Tapas','UN',10,40),
  -- Harinas
  ('Harinas','Harina 3C','KG',5,25),
  ('Harinas','Harina Integral','KG',2,10),
  ('Harinas','Sémola','KG',1,5),
  ('Harinas','Harina de Trigo','KG',5,25),
  ('Harinas','Pan Rallado','KG',1,5);

insert into productos (categoria_id, nombre, unidad_medida, stock_minimo, stock_ideal)
select c.id, s.nombre, s.unidad_medida, s.stock_minimo, s.stock_ideal
from seed_productos s
join categorias c on c.nombre = s.categoria
on conflict (categoria_id, nombre) do update set
  unidad_medida = excluded.unidad_medida,
  stock_minimo = excluded.stock_minimo,
  stock_ideal = excluded.stock_ideal;
