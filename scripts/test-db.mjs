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
  await db.query(readFileSync('supabase/seed3_planillas.sql', 'utf8'));
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
