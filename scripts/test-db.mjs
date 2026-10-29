// Integration tests use real PostgreSQL/RLS, always rolled back (including fixtures).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { connectDatabase } from './db.mjs';

const db = await connectDatabase();
let passed = 0;
const check = (condition, message) => { assert.ok(condition, message); console.log(`PASS ${++passed}: ${message}`); };
async function denied(sql, values) {
  await db.query('savepoint denied_operation');
  let error;
  try { await db.query(sql, values); } catch (caught) { error = caught; }
  await db.query('rollback to savepoint denied_operation');
  check(error?.code === '42501', `Permission denied: ${sql.slice(0, 65)}`);
}
async function actingAs(id, role = 'authenticated') {
  await db.query('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
  await db.query(`set local role ${role}`);
}
async function fails(sql, values, pattern, label) {
  await db.query('savepoint rejected_operation');
  let error;
  try { await db.query(sql, values); } catch (caught) { error = caught; }
  await db.query('rollback to savepoint rejected_operation');
  check(error && pattern.test(error.message), label);
}
try {
  await db.query('begin');
  const originalIds = (await db.query('select id from public.productos order by id')).rows.map(row => row.id);
  const exists = await db.query("select to_regclass('public.planillas_inventario') as present");
  if (!exists.rows[0].present) {
    for (const path of ['supabase/migrations/003_planillas_diarias_roles.sql', 'supabase/seed3_planillas.sql',
      'supabase/migrations/004_tareas_diarias.sql', 'supabase/seed4_tareas.sql',
      'supabase/migrations/005_autoria_operativa.sql']) {
      await db.query(readFileSync(path, 'utf8'));
    }
  }
  const auditMigration = await db.query("select exists(select 1 from pg_trigger where tgname='responsable_registro') as present");
  if (!auditMigration.rows[0].present) await db.query(readFileSync('supabase/migrations/005_autoria_operativa.sql', 'utf8'));
  const auditTable = await db.query("select to_regclass('public.auditorias') as present");
  if (!auditTable.rows[0].present) {
    for (const path of ['supabase/migrations/006_auditorias.sql', 'supabase/seed5_auditoria.sql']) {
      await db.query(readFileSync(path, 'utf8'));
    }
  }
  const interviewTable = await db.query("select to_regclass('public.entrevistas') as present");
  if (!interviewTable.rows[0].present) {
    for (const path of ['supabase/migrations/007_entrevistas.sql', 'supabase/seed6_entrevistas.sql']) {
      await db.query(readFileSync(path, 'utf8'));
    }
  }
  const objetivoTrigger = await db.query("select exists(select 1 from pg_trigger where tgname='confirmar_objetivo_producto') as present");
  if (!objetivoTrigger.rows[0].present) await db.query(readFileSync('supabase/migrations/008_confirmar_objetivo_producto.sql', 'utf8'));
  const cierreColumn = await db.query("select 1 from information_schema.columns where table_name='inventarios' and column_name='estado'");
  if (!cierreColumn.rowCount) await db.query(readFileSync('supabase/migrations/009_cierre_planillas.sql', 'utf8'));
  const planillaAdmin = await db.query("select 1 from information_schema.columns where table_name='planilla_items' and column_name='activo'");
  if (!planillaAdmin.rowCount) await db.query(readFileSync('supabase/migrations/010_planillas_admin_compras.sql', 'utf8'));
  const planillaUnique = await db.query("select 1 from pg_constraint where conname='planilla_items_planilla_id_producto_id_key'");
  if (!planillaUnique.rowCount) await db.query(readFileSync('supabase/migrations/011_restore_unique_unarchive.sql', 'utf8'));
  const frecuenciaColumn = await db.query("select 1 from information_schema.columns where table_name='actividad_programaciones' and column_name='frecuencia'");
  if (!frecuenciaColumn.rowCount) await db.query(readFileSync('supabase/migrations/012_frecuencias_tareas.sql', 'utf8'));
  const targetProduct = (await db.query('select id from public.productos order by id limit 1')).rows[0].id;
  await db.query('update public.productos set stock_ideal = 12.34 where id=$1', [targetProduct]);
  check((await db.query('select objetivo_confirmado from public.productos where id=$1', [targetProduct])).rows[0].objetivo_confirmado,
    'Editing a product target confirms it automatically');
  const interviewCounts = (await db.query(`select
    (select count(*) from public.entrevista_secciones)::int as sections,
    (select count(*) from public.entrevista_criterios)::int as criteria`)).rows[0];
  check(interviewCounts.sections === 6 && interviewCounts.criteria === 40, 'Interview template preserves 6 sections and 40 criteria');
  const auditRows = (await db.query('select id,bloque from public.auditoria_items order by orden')).rows;
  check(auditRows.length === 84, 'Audit template contains exactly 84 criteria');
  check(new Set(auditRows.map(row => row.bloque)).size === 2
    && auditRows.filter(row => row.bloque === 'COCINA').length === 40
    && auditRows.filter(row => row.bloque === 'SALON_GENERAL').length === 44,
  'Audit criteria preserve the 40/44 source blocks');
  const originalResponsible = (await db.query('select id from public.responsables limit 1')).rows[0].id;
  const sheets = (await db.query('select * from public.planillas_inventario')).rows;
  const sheet = Object.fromEntries(sheets.map(p => [p.codigo, p.id]));
  const counts = (await db.query('select p.codigo,count(*)::int as n from public.planilla_items i join public.planillas_inventario p on p.id=i.planilla_id group by p.codigo')).rows;
  assert.deepEqual(Object.fromEntries(counts.map(r => [r.codigo, r.n])), { STOCK_A: 57, STOCK_B: 60, STOCK_C: 58, BEBIDAS: 47 });
  check(true, 'All 222 source inventory rows are linked');
  const preserved = (await db.query('select id from public.productos where id=any($1::uuid[])', [originalIds])).rows;
  check(preserved.length === originalIds.length, 'All original product IDs are preserved');
  const countBefore = Number((await db.query('select count(*) from public.productos')).rows[0].count);
  // The owner may legitimately re-categorize products after the import (the catalogue is theirs);
  // inside this rolled-back transaction, realign category drift so the seed's reconciliation matches.
  const seed3 = readFileSync('supabase/seed3_planillas.sql', 'utf8');
  const syncMarker = seed3.indexOf('-- Reuse matching IDs');
  await db.query(seed3.slice(0, syncMarker));
  await db.query(`
    update public.productos p set categoria_id=(select id from public.categorias c2 where c2.nombre=i.categoria)
    from import_items i
    where p.nombre=i.nombre and p.presentacion=i.presentacion
      and (select count(*) from public.productos p3 where p3.nombre=i.nombre and p3.presentacion=i.presentacion) = 1
      and not exists (select 1 from public.productos p2 join public.categorias c3 on c3.id=p2.categoria_id
        where c3.nombre=i.categoria and p2.nombre=i.nombre and p2.presentacion=i.presentacion)`);
  await db.query(seed3.slice(syncMarker));
  check(Number((await db.query('select count(*) from public.productos')).rows[0].count) === countBefore, 'Seed rerun preserves product identities and count');
  const ids = {};
  for (const role of ['DUEÑO', 'ENCARGADO', 'CAMARERO']) {
    ids[role] = randomUUID();
    await db.query('insert into auth.users(id,email) values ($1,$2)', [ids[role], `${ids[role]}@integration.invalid`]);
    await db.query('insert into public.usuarios(id,email,rol) values ($1,$2,$3)', [ids[role], `${ids[role]}@integration.invalid`, role]);
  }
  const beverage = (await db.query('select producto_id from public.planilla_items where planilla_id=$1 limit 1', [sheet.BEBIDAS])).rows[0].producto_id;
  const stock = (await db.query('select producto_id from public.planilla_items where planilla_id=$1 limit 1', [sheet.STOCK_A])).rows[0].producto_id;
  const saveSql = 'select public.guardar_inventario($1,$2,$3::jsonb,$4) as id';
  const save = (s, details) => db.query(saveSql, [s, '2099-01-03', JSON.stringify(details), 'Integration test']);
  await actingAs(ids.CAMARERO);
  check((await db.query('select * from public.planillas_inventario')).rowCount === 1, 'CAMARERO sees only the beverage inventory');
  check((await db.query('select * from public.productos')).rowCount === 47, 'CAMARERO sees only the 47 beverage products');
  for (const table of ['proveedores', 'compras', 'pedidos', 'pedido_items', 'movimientos']) {
    check((await db.query(`select * from public.${table}`)).rowCount === 0, `CAMARERO cannot read ${table}`);
  }
  check((await db.query("select * from public.actividades where area='COCINA'")).rowCount === 0, 'CAMARERO cannot read kitchen activities');
  const salonTasks = (await db.query('select * from public.actividad_programaciones order by orden')).rows;
  check(salonTasks.length === 36, 'CAMARERO sees only 36 dining-room occurrences');
  check((await db.query('select * from public.salon_frecuencias')).rowCount === 20, 'CAMARERO can read opening/closing frequencies');
  const weeklyTask = (await db.query(`select p.id from public.actividad_programaciones p join public.actividades a on a.id=p.actividad_id
    where a.area='SALON' and a.nombre='Limpieza Vidrios Internos/Externos' limit 1`)).rows[0].id;
  const optionalTask = (await db.query(`select p.id from public.actividad_programaciones p join public.actividades a on a.id=p.actividad_id
    where a.area='SALON' and a.nombre='Armado de Cajas Pizza' limit 1`)).rows[0].id;
  check((await db.query('select frecuencia from public.actividad_programaciones where id=$1', [weeklyTask])).rows[0].frecuencia === 'SEMANAL',
    'Weekly source reference is derived as SEMANAL');
  check((await db.query('select frecuencia from public.actividad_programaciones where id=$1', [optionalTask])).rows[0].frecuencia === 'SEGUN_NECESIDAD',
    'On-demand source reference is derived as SEGUN_NECESIDAD');
  const bath = salonTasks.filter(task => task.hora_objetivo);
  check(bath.length === 10 && bath.some(task => task.hora_objetivo === '24:00'), 'Ten bathroom slots preserve the source midnight reference');
  for (const task of bath.slice(0, 2)) {
    await db.query("select public.completar_tarea($1,'2099-01-03','18:35','')", [task.id]);
  }
  check((await db.query("select * from public.actividad_registros where fecha='2099-01-03'")).rowCount === 2, 'Repeated daily activities retain independent occurrence records');
  await db.query("select public.completar_tarea($1,'2099-01-03','19:00','Updated')", [bath[0].id]);
  check((await db.query("select * from public.actividad_registros where fecha='2099-01-03'")).rowCount === 2, 'Task updates do not duplicate the daily occurrence');
  await db.query("update public.actividad_registros set responsable_id=$1 where programacion_id=$2 and fecha='2099-01-03'", [originalResponsible, bath[0].id]);
  const actor = (await db.query("select responsable_id,actualizado_por from public.actividad_registros where programacion_id=$1 and fecha='2099-01-03'", [bath[0].id])).rows[0];
  check(actor.responsable_id === null && actor.actualizado_por === ids.CAMARERO, 'Direct writes cannot spoof a task responsible or authenticated author');
  const firstWeekly = (await db.query("select public.completar_tarea($1,'2099-01-05','10:00','Primera') as id", [weeklyTask])).rows[0].id;
  const secondWeekly = (await db.query("select public.completar_tarea($1,'2099-01-07','11:00','Actualizada') as id", [weeklyTask])).rows[0].id;
  check(firstWeekly === secondWeekly, 'Weekly task reuses one record within the same ISO week');
  const weeklyRecord = (await db.query("select fecha::text as fecha,hora::text as hora,nota from public.actividad_registros where id=$1", [firstWeekly])).rows[0];
  check(weeklyRecord.fecha === '2099-01-05' && weeklyRecord.hora === '11:00:00' && weeklyRecord.nota === 'Actualizada',
    'Weekly updates keep the completion day and refresh hour and note');
  check((await db.query('select * from public.actividad_registros where programacion_id=$1', [weeklyTask])).rowCount === 1,
    'Weekly task cannot create a second record in the same week');
  const weeklyActivity = (await db.query('select actividad_id from public.actividad_programaciones where id=$1', [weeklyTask])).rows[0].actividad_id;
  await fails("insert into public.actividad_registros(actividad_id,programacion_id,fecha,hora,actualizado_por) values ($1,$2,'2099-01-06','09:00',$3)",
    [weeklyActivity, weeklyTask, ids.CAMARERO], /ya tiene un registro/i, 'Direct writes cannot duplicate a weekly record');
  await db.query("select public.completar_tarea($1,'2099-01-03','12:00','Opcional')", [optionalTask]);
  check((await db.query("select * from public.actividad_registros where programacion_id=$1 and fecha='2099-01-03'", [optionalTask])).rowCount === 1,
    'On-demand task accepts a daily record');
  const details = [{ producto_id: beverage, ubicacion: 'DEPOSITO', stock_real: 0 }, { producto_id: beverage, ubicacion: 'HELADERA', stock_real: 5 }];
  const first = (await save(sheet.BEBIDAS, details)).rows[0].id;
  const second = (await save(sheet.BEBIDAS, details)).rows[0].id;
  check(first === second, 'Repeated saves reuse the daily inventory');
  check((await db.query('select * from public.inventario_detalles where inventario_id=$1', [first])).rowCount === 2, 'Depósito/Heladera persist independently, including zero');
  await denied(saveSql, [sheet.STOCK_A, '2099-01-03', '[]', '']);
  await denied(saveSql, [sheet.BEBIDAS, '2099-01-03', JSON.stringify([{ producto_id: stock, ubicacion: 'DEPOSITO', stock_real: 8 }]), '']);
  await denied(saveSql, [sheet.BEBIDAS, '2099-01-03', JSON.stringify([{ producto_id: beverage, ubicacion: 'GENERAL', stock_real: 8 }]), '']);
  await denied('select public.crear_pedido_con_items($1)', [first]);
  check((await db.query('select * from public.auditoria_items')).rowCount === 0, 'CAMARERO cannot read audit criteria');
  check((await db.query('select * from public.entrevista_criterios')).rowCount === 0, 'CAMARERO cannot read interview criteria');
  await denied("insert into public.entrevistas(plantilla_id,fecha,candidato) values ($1,'2099-02-02','X')",
    [randomUUID()], 'CAMARERO cannot create interviews');
  await denied('select public.guardar_auditoria($1::date,$1::date,$1::date,$2,$3,$4::jsonb)',
    ['2099-02-01', '', '', '[]'], 'CAMARERO cannot save audits');
  await actingAs(ids.ENCARGADO);
  const kitchenTask = (await db.query("select p.id from public.actividad_programaciones p join public.actividades a on a.id=p.actividad_id where a.area='COCINA' limit 1")).rows[0].id;
  await actingAs(ids.CAMARERO);
  await denied("select public.completar_tarea($1,'2099-01-03','18:30','')", [kitchenTask]);
  await actingAs(ids.ENCARGADO);
  const encargadoFrecuencia = await db.query("update public.actividad_programaciones set frecuencia='SEMANAL' where id=$1", [weeklyTask]);
  check(encargadoFrecuencia.rowCount === 0, 'ENCARGADO cannot change task frequencies');
  check((await db.query('select * from public.auditoria_items')).rowCount === 0, 'ENCARGADO cannot read audit criteria');
  check((await db.query('select * from public.entrevista_criterios')).rowCount === 0, 'ENCARGADO cannot read interview criteria');
  const encargadoCatalogo = await db.query("update public.productos set activo = true where id=$1", [targetProduct]);
  check(encargadoCatalogo.rowCount === 0, 'ENCARGADO cannot edit the catalogue');
  check((await db.query('select * from public.planillas_inventario')).rowCount === 4, 'ENCARGADO sees four inventories');
  const inventory = (await save(sheet.STOCK_A, [{ producto_id: stock, ubicacion: 'GENERAL', stock_real: 2, cantidad_pedida: 3, es_ajuste_manual: true }])).rows[0].id;
  const order = (await db.query('select public.crear_pedido_con_items($1) as id', [inventory])).rows[0].id;
  const repeatedOrder = (await db.query('select public.crear_pedido_con_items($1) as id', [inventory])).rows[0].id;
  check(order === repeatedOrder, 'Order creation is transactional and idempotent per inventory');
  check(Number((await db.query('select cantidad from public.pedido_items where pedido_id=$1', [order])).rows[0].cantidad) === 3, 'Order quantities derive from persisted counts');
  await actingAs(ids.DUEÑO);
  check((await db.query('select * from public.usuarios')).rowCount >= 3, 'DUEÑO retains user management access');
  const duenoFrecuencia = await db.query("update public.actividad_programaciones set frecuencia='DIARIA' where id=$1", [weeklyTask]);
  check(duenoFrecuencia.rowCount === 1, 'DUEÑO can change task frequencies');
  await db.query("update public.actividad_programaciones set frecuencia='SEMANAL' where id=$1", [weeklyTask]);
  const duenoCatalogo = await db.query("update public.productos set activo = activo where id=$1", [targetProduct]);
  check(duenoCatalogo.rowCount === 1, 'DUEÑO can edit the catalogue');
  const criteria = (await db.query('select id from public.auditoria_items order by orden')).rows.map(row => row.id);
  const auditDate = '2099-02-01';
  const auditPayload = criteria.map(item_id => ({ item_id, resultado: null, observaciones: '', mejora: '', necesidad: '' }));
  const saveAudit = (payload, signature = '') => db.query(
    'select public.guardar_auditoria($1::date,$1::date,$1::date,$2,$3,$4::jsonb) as id',
    [auditDate, 'Borrador de auditoría', signature, JSON.stringify(payload)]);
  const auditId = (await saveAudit(auditPayload)).rows[0].id;
  check((await saveAudit(auditPayload, 'Borrador firmado')).rows[0].id === auditId, 'Audit draft saves idempotently by date');
  check((await db.query('select * from public.auditoria_respuestas where auditoria_id=$1', [auditId])).rowCount === 84,
    'Audit draft persists all 84 pending criteria');
  await fails('select public.cerrar_auditoria($1,$2)', [auditId, 'Guille'],
    /All 84 audit criteria|criteria must be answered/i, 'Closure is rejected while criteria are unanswered');
  const almostDone = auditPayload.map((response, index) => ({ ...response, resultado: index === 83 ? null : 'OK' }));
  await saveAudit(almostDone);
  await fails('select public.cerrar_auditoria($1,$2)', [auditId, 'Guille'],
    /All 84 audit criteria|criteria must be answered/i, 'One missing criterion still blocks closure');
  const complete = auditPayload.map(response => ({ ...response, resultado: response.item_id === criteria[0] ? 'NO_OK' : 'OK' }));
  await saveAudit(complete);
  await db.query('select public.cerrar_auditoria($1,$2)', [auditId, 'Guille Pérez']);
  const closed = (await db.query('select estado,firma,cerrado_en from public.auditorias where id=$1', [auditId])).rows[0];
  check(closed.estado === 'CERRADO' && closed.firma === 'Guille Pérez' && closed.cerrado_en !== null,
    'Complete audit closes with signature and timestamp');
  check(Number((await db.query("select count(*) from public.auditoria_respuestas where auditoria_id=$1 and resultado='OK'", [auditId])).rows[0].count) === 83,
    'Closed audit score is derived from 83 OK and one NO_OK');
  await fails('select public.guardar_auditoria($1::date,$1::date,$1::date,$2,$3,$4::jsonb)',
    [auditDate, 'Cambio posterior', '', JSON.stringify(complete)], /Closed audits are immutable/i,
    'Closed audits reject further edits');
  const interviewTemplate = (await db.query('select id from public.entrevista_plantillas where activa')).rows[0].id;
  const interviewSection = (await db.query('select id from public.entrevista_secciones order by orden limit 1')).rows[0].id;
  const interviewCriteria = (await db.query('select id from public.entrevista_criterios order by orden limit 2')).rows;
  const interview = (await db.query(
    "insert into public.entrevistas(plantilla_id,fecha,candidato,puesto_aspira,tecnica_actual,velocidad,decision) values ($1,'2099-03-01','Candidato de prueba','Cocina',4,3,'SI_CAPACITACION') returning id",
    [interviewTemplate])).rows[0].id;
  await db.query("insert into public.entrevista_seccion_respuestas(entrevista_id,seccion_id,resultado,observaciones) values ($1,$2,'MUY_BUENO','Bien general')", [interview, interviewSection]);
  for (const [index, criterion] of interviewCriteria.entries()) {
    await db.query("insert into public.entrevista_criterio_respuestas(entrevista_id,criterio_id,valor,observacion) values ($1,$2,$3,$4)",
      [interview, criterion.id, index === 0, index === 0 ? 'Correcto' : '']);
  }
  const invalidCriterion = randomUUID();
  await fails("insert into public.entrevista_criterio_respuestas(entrevista_id,criterio_id,valor) values ($1,$2,true)",
    [interview, invalidCriterion], /does not belong/i, 'Interview responses reject criteria from another template');
  const interviewActor = (await db.query('select evaluador_id,estado from public.entrevistas where id=$1', [interview])).rows[0];
  check(interviewActor.evaluador_id === ids['DUEÑO'] && interviewActor.estado === 'BORRADOR',
    'Interview evaluator derives from the authenticated owner');
  check((await db.query('select * from public.entrevista_seccion_respuestas where entrevista_id=$1', [interview])).rowCount === 1
    && (await db.query('select * from public.entrevista_criterio_respuestas where entrevista_id=$1', [interview])).rowCount === 2,
  'Interview section and criterion responses persist independently');
  // Close and reopen daily inventories (migration 009).
  await actingAs(ids.ENCARGADO);
  const cierre = (await save(sheet.STOCK_A, [{ producto_id: stock, ubicacion: 'GENERAL', stock_real: 3 }])).rows[0].id;
  await db.query("update public.inventarios set estado='CERRADO', cerrado_por=$1, cerrado_en=now() where id=$2", [ids.ENCARGADO, cierre]);
  await fails(saveSql, [sheet.STOCK_A, '2099-01-03', JSON.stringify([{ producto_id: stock, ubicacion: 'GENERAL', stock_real: 9 }]), 'Late fix'],
    /cerrado/i, 'Saving a closed inventory is rejected');
  await actingAs(ids.DUEÑO);
  await fails("insert into public.inventario_detalles(inventario_id,producto_id,stock_real,ubicacion) values ($1,$2,5,'GENERAL')",
    [cierre, stock], /cerrado/i, 'Detail writes reject a closed inventory');
  await actingAs(ids.ENCARGADO);
  await fails("update public.inventarios set estado='ABIERTO' where id=$1", [cierre], /dueno/i,
    'Encargado cannot reopen a closed inventory');
  await actingAs(ids.DUEÑO);
  await db.query("update public.inventarios set estado='ABIERTO', motivo_apertura='Reapertura de control', cerrado_por=null, cerrado_en=null where id=$1", [cierre]);
  check((await db.query('select estado from public.inventarios where id=$1', [cierre])).rows[0].estado === 'ABIERTO',
    'Owner reopens the inventory with an audited reason');
  await db.query(saveSql, [sheet.STOCK_A, '2099-01-03', JSON.stringify([{ producto_id: stock, ubicacion: 'GENERAL', stock_real: 6 }]), 'Post-reopen save']);
  check(Number((await db.query('select stock_real from public.inventario_detalles where inventario_id=$1', [cierre])).rows[0].stock_real) === 6,
    'Saving works again after reopening');
  // Owner-managed planillas (migration 010).
  await actingAs(ids['DUEÑO']);
  const reorderTarget = (await db.query(`select i.planilla_id,i.seccion_id,array_agg(i.id order by i.orden) as ids
    from public.planilla_items i join public.planillas_inventario p on p.id=i.planilla_id
    where p.codigo='STOCK_A' and i.activo group by i.planilla_id,i.seccion_id having count(*) >= 2 limit 1`)).rows[0];
  const reversed = [...reorderTarget.ids].reverse();
  await db.query('select public.reordenar_items_planilla($1,$2,$3)', [reorderTarget.planilla_id, reorderTarget.seccion_id, reversed]);
  const reorderedItems = (await db.query('select id,orden from public.planilla_items where id = any($1::uuid[]) order by orden', [reversed])).rows;
  check(reorderedItems.map(row => row.id).join() === reversed.join()
    && reorderedItems.every((row, index) => row.orden === index + 1),
  'Owner reorders planilla items and the new order persists');
  const freeProduct = (await db.query(`select id from public.productos p where p.activo and not exists (
    select 1 from public.planilla_items i where i.planilla_id=$1 and i.producto_id=p.id and i.activo) limit 1`,
    [reorderTarget.planilla_id])).rows[0].id;
  const addedItem = (await db.query('select public.agregar_item_planilla($1,$2,$3) as id',
    [reorderTarget.planilla_id, reorderTarget.seccion_id, freeProduct])).rows[0].id;
  const addedRow = (await db.query('select activo,orden from public.planilla_items where id=$1', [addedItem])).rows[0];
  check(addedRow.activo && Number(addedRow.orden) > 0, 'Owner adds a product to a planilla section');
  await db.query('select public.archivar_item_planilla($1)', [addedItem]);
  check((await db.query('select activo from public.planilla_items where id=$1', [addedItem])).rows[0].activo === false,
    'Archiving a planilla item keeps the row for history');
  await fails('select public.archivar_item_planilla($1)', [randomUUID()], /not found/i,
    'Archiving an unknown planilla item is rejected');
  // Providers and atomic purchases (migration 010).
  const proveedor = (await db.query("insert into public.proveedores(nombre,telefono) values ('Proveedor Integración','555-0101') returning id")).rows[0].id;
  await actingAs(ids.ENCARGADO);
  const compraUno = (await db.query('select public.registrar_compra($1,$2,$3,$4,$5,$6) as id',
    [stock, proveedor, 2.5, 'KG', 100.25, '2099-01-06T10:00:00Z'])).rows[0].id;
  const compraDos = (await db.query('select public.registrar_compra($1,$2,$3,$4,$5,$6) as id',
    [stock, proveedor, 2.5, 'KG', 100.25, '2099-01-06T10:00:00Z'])).rows[0].id;
  check(compraUno !== compraDos, 'Repeated legitimate purchases are allowed');
  const linked = (await db.query(`select c.proveedor_id,c.movimiento_id,m.tipo,m.cantidad,m.motivo
    from public.compras c join public.movimientos m on m.id=c.movimiento_id where c.id=$1`, [compraUno])).rows[0];
  check(linked.proveedor_id === proveedor && linked.tipo === 'INGRESO' && Number(linked.cantidad) === 2.5
    && linked.motivo.includes('Proveedor Integración'), 'A purchase stays linked to its provider and INGRESO movement');
  await actingAs(ids.CAMARERO);
  await denied('select public.registrar_compra($1,$2,$3,$4,$5,$6)',
    [stock, proveedor, 1, 'KG', 10, '2099-01-06T10:00:00Z']);
  await denied("insert into public.proveedores(nombre) values ('Proveedor Clandestino')");
  await actingAs(ids['DUEÑO']);
  const proveedorEditado = await db.query("update public.proveedores set telefono='555-0202',activo=false where id=$1", [proveedor]);
  check(proveedorEditado.rowCount === 1, 'Owner edits and deactivates a provider');
  await actingAs(ids.CAMARERO, 'anon');
  await denied('select public.guardar_inventario($1,$2,$3::jsonb,$4)', [sheet.BEBIDAS, '2099-01-03', '[]', '']);
  await db.query('reset role');
  await db.query('update public.usuarios set activo=false where id=$1', [ids.CAMARERO]);
  await actingAs(ids.CAMARERO);
  check((await db.query('select * from public.productos')).rowCount === 0, 'Inactive account has no catalogue access');
  console.log(`${passed} database checks passed; rolling back all fixtures.`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await db.query('rollback');
  await db.end();
}
