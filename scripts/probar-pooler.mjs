// Prueba pooler por región. Uso: node scripts/probar-pooler.mjs
import { readFileSync } from "node:fs";
import pg from "pg";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}
const pass = env.POOLER_URL.split(":")[2].split("@")[0];

for (const region of ["us-east-1", "us-west-1", "eu-west-1", "eu-central-1", "ap-southeast-1"]) {
  const u = `postgresql://postgres.rceoboibijmwtxmevash:${pass}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
  const c = new pg.Client({
    connectionString: u,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  try {
    await c.connect();
    await c.query("select 1");
    console.log(`${region}: OK`);
    await c.end();
    break;
  } catch (e) {
    console.log(`${region}: ${String(e.message).split("\n")[0]}`);
  }
}
