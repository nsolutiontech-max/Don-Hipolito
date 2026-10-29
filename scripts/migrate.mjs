// Existing installations only. Never rerun the legacy schema or estimated seeds.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { connectDatabase } from './db.mjs';

export const files = [
  'supabase/migrations/003_planillas_diarias_roles.sql',
  'supabase/seed3_planillas.sql',
  'supabase/migrations/004_tareas_diarias.sql',
  'supabase/seed4_tareas.sql',
  'supabase/migrations/005_autoria_operativa.sql',
  'supabase/migrations/006_auditorias.sql',
  'supabase/seed5_auditoria.sql',
  'supabase/migrations/007_entrevistas.sql',
  'supabase/seed6_entrevistas.sql',
  'supabase/migrations/008_confirmar_objetivo_producto.sql',
  'supabase/migrations/009_cierre_planillas.sql',
  'supabase/migrations/010_planillas_admin_compras.sql',
  'supabase/migrations/011_restore_unique_unarchive.sql',
  'supabase/migrations/012_frecuencias_tareas.sql',
];

const db = await connectDatabase();
try {
  await db.query('begin');
  await db.query("select pg_advisory_xact_lock(hashtext('hipolito:migrations'))");
  await db.query('create schema if not exists private');
  await db.query('create table if not exists private.app_migrations(path text primary key, checksum text not null, applied_at timestamptz not null default now())');
  for (const path of files) {
    const sql = readFileSync(path, 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const previous = await db.query('select checksum from private.app_migrations where path=$1', [path]);
    if (previous.rowCount) {
      if (previous.rows[0].checksum !== checksum) throw new Error(`Applied migration changed: ${path}`);
      console.log(`SKIP ${path}`);
      continue;
    }
    await db.query(sql);
    await db.query('insert into private.app_migrations(path,checksum) values ($1,$2)', [path, checksum]);
    console.log(`OK ${path}`);
  }
  await db.query('commit');
} catch (error) {
  await db.query('rollback');
  console.error('Migration rolled back:', error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
