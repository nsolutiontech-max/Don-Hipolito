import { connectDatabase } from './db.mjs';

const db = await connectDatabase();
try {
  const result = await db.query(`select p.codigo, count(i.id)::int as items
    from public.planillas_inventario p left join public.planilla_items i on i.planilla_id=p.id
    group by p.codigo order by p.codigo`);
  console.table(result.rows);
  const users = await db.query('select rol,count(*)::int as total from public.usuarios group by rol');
  console.table(users.rows);
} finally {
  await db.end();
}
