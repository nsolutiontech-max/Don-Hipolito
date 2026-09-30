-- Seed 2: planilla A (Quesos, Fiambres, Congelados, Varios) + Actividades (planilla D)
-- Ejecutar DESPUÉS de 002. Re-ejecutable (upserts).

insert into categorias (nombre, orden) values
  ('Quesos', 7), ('Fiambres', 8), ('Congelados', 9), ('Varios', 10)
on conflict (nombre) do nothing;

create temp table seed_productos_a (
  categoria text, nombre text, unidad_medida text,
  stock_minimo numeric(10,2), stock_ideal numeric(10,2)
) on commit drop;

insert into seed_productos_a values
  -- Quesos
  ('Quesos','Muzzarella A','KG',5,20),
  ('Quesos','Muzzarella C','KG',5,20),
  ('Quesos','Provolone','KG',1,4),
  ('Quesos','Parmesano','KG',1,4),
  ('Quesos','Gouda','KG',1,3),
  ('Quesos','Reggianito','KG',1,3),
  ('Quesos','Queso Azul','KG',0.5,2),
  -- Fiambres
  ('Fiambres','Jamón Cocido','KG',2,6),
  ('Fiambres','Jamón Crudo','KG',1,3),
  ('Fiambres','Panceta Ahumada','KG',1,3),
  ('Fiambres','Longaniza','KG',1,3),
  ('Fiambres','Lomo','KG',1,2),
  ('Fiambres','Salame','UN',2,8),
  ('Fiambres','Paleta','KG',1,3),
  -- Congelados
  ('Congelados','Empanada de Carne','UN',20,100),
  ('Congelados','Empanada de Pollo','UN',20,100),
  ('Congelados','Empanada de Jamón y Queso','UN',20,100),
  ('Congelados','Empanada de Choclo','UN',10,50),
  ('Congelados','Empanada de Verdura','UN',10,50),
  ('Congelados','Empanada de Humita','UN',10,50),
  ('Congelados','Milanesas','UN',10,40),
  ('Congelados','Hamburguesas','UN',10,40),
  ('Congelados','Papas Fritas','KG',3,10),
  -- Varios
  ('Varios','Leche','LT',4,12),
  ('Varios','Crema','LT',2,6),
  ('Varios','Manteca','KG',1,4),
  ('Varios','Aceitunas Verdes','KG',1,3),
  ('Varios','Aceitunas Negras','KG',1,3),
  ('Varios','Azúcar','KG',2,6),
  ('Varios','Dulce de Leche','KG',1,4);

insert into productos (categoria_id, nombre, unidad_medida, stock_minimo, stock_ideal)
select c.id, s.nombre, s.unidad_medida, s.stock_minimo, s.stock_ideal
from seed_productos_a s
join categorias c on c.nombre = s.categoria
on conflict (categoria_id, nombre) do update set
  unidad_medida = excluded.unidad_medida,
  stock_minimo = excluded.stock_minimo,
  stock_ideal = excluded.stock_ideal;

-- Actividades (planilla D)
create temp table seed_actividades (grupo text, nombre text, orden int) on commit drop;

insert into seed_actividades values
  ('Masa', 'Amasado', 1),
  ('Masa', 'Bollado', 2),
  ('Masa', 'Preparar Masa', 3),
  ('Rellenos', 'Relleno Carne', 4),
  ('Rellenos', 'Relleno Pollo', 5),
  ('Rellenos', 'Relleno Jamón y Queso', 6),
  ('Rellenos', 'Relleno Choclo', 7),
  ('Rellenos', 'Relleno Verdura', 8),
  ('Rellenos', 'Relleno Humita', 9),
  ('Salsas', 'Preparar Salsa Pizza', 10),
  ('Controles', 'Control Stock Empanadas', 11),
  ('Controles', 'Control Stock Masas y Bollos', 12),
  ('Controles', 'Control Stock General', 13),
  ('Producción', 'Producción Milanesas', 14),
  ('Producción', 'Armado de Mise en Place', 15),
  ('Producción', 'Afilado de Cuchillos', 16),
  ('Limpieza', 'Limpieza Cocina', 17),
  ('Limpieza', 'Limpieza Mostrador', 18),
  ('Limpieza', 'Limpieza Heladeras', 19),
  ('Limpieza', 'Limpieza Freidora', 20),
  ('Limpieza', 'Limpieza Hornos', 21),
  ('Limpieza', 'Limpieza Pisos', 22),
  ('Limpieza', 'Limpieza Baños', 23),
  ('Limpieza', 'Limpieza Freezers', 24),
  ('Plegado', 'Plegado 1', 25),
  ('Plegado', 'Plegado 2', 26),
  ('Plegado', 'Plegado 3', 27);

insert into actividades (nombre, grupo, orden)
select nombre, grupo, orden from seed_actividades
on conflict (nombre) do update set grupo = excluded.grupo, orden = excluded.orden;
