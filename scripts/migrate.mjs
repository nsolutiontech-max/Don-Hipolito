// Aplica 001 + 002 + seeds contra la DB real usando DATABASE_URL de .env.local.
// Uso: node scripts/migrate.mjs
// Verifica el project ref en la URL antes de tocar nada.
import { readFileSync } from "node:fs";
import pg from "pg";

const ESPERADO_REF = "rceoboibijmwtxmevash";

function cargarEnv(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  return env;
}

const env = cargarEnv(".env.local");
// Pooler IPv4 primero (el host direct es IPv6-only y Node no lo resuelve acá).
const url = env.POOLER_URL || env.DATABASE_URL;
if (!url || !url.includes(ESPERADO_REF)) {
  console.error(`REF VERIFICATION FAILED: la URL no contiene ${ESPERADO_REF}. Freno todo.`);
  process.exit(1);
}
console.log(`Ref verificado: ${ESPERADO_REF}. Aplicando migraciones...`);

const archivos = [
  "supabase/migrations/001_schema.sql",
  "supabase/migrations/002_seguridad_y_nuevas_tablas.sql",
  "supabase/seed.sql",
  "supabase/seed2.sql",
].filter((f) => {
  const solo = process.argv.slice(2);
  return solo.length === 0 || solo.some((s) => f.includes(s));
});
if (archivos.length === 0) {
  console.error("Nada para aplicar (filtro sin coincidencias).");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  for (const f of archivos) {
    const sql = readFileSync(f, "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw new Error(`${f}: ${e.message}`);
    }
    console.log(`OK: ${f}`);
  }
  const tablas = await client.query(
    `select tablename from pg_tables where schemaname='public' order by tablename`,
  );
  console.log("TABLAS:", tablas.rows.map((r) => r.tablename).join(", "));
  const conteos = await client.query(
    `select 'categorias' t, count(*) from categorias
     union all select 'productos', count(*) from productos
     union all select 'responsables', count(*) from responsables
     union all select 'actividades', count(*) from actividades`,
  );
  for (const r of conteos.rows) console.log(`COUNT ${r.t}: ${r.count}`);
} catch (e) {
  console.error("MIGRATION FAILED:", e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
