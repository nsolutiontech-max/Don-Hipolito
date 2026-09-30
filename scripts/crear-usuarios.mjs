// Crea los 3 usuarios Auth + filas en usuarios con rol y responsable.
// Uso: node scripts/crear-usuarios.mjs
// Genera contraseñas temporales, las IMPRIME una vez (entregar y rotar).
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data: resps } = await db.from("responsables").select("id,nombre");
const respId = Object.fromEntries((resps ?? []).map((r) => [r.nombre, r.id]));

const ALTAS = [
  { email: "Guille@donhipolito.com", rol: "DUEÑO", responsable: null },
  { email: "nico@donhipolito.com", rol: "ENCARGADO", responsable: "Nicolas" },
  { email: "namir@donhipolito.com", rol: "ENCARGADO", responsable: "Namir" },
];

for (const a of ALTAS) {
  const password = randomBytes(9).toString("base64url");
  const { data, error } = await db.auth.admin.createUser({
    email: a.email,
    password,
    email_confirm: true,
  });
  if (error) {
    console.log(`${a.email}: ERROR ${error.message}`);
    continue;
  }
  const { error: e2 } = await db.from("usuarios").insert({
    id: data.user.id,
    email: a.email,
    rol: a.rol,
    responsable_id: a.responsable ? (respId[a.responsable] ?? null) : null,
  });
  if (e2) {
    console.log(`${a.email}: AUTH OK pero USUARIOS ERROR ${e2.message}`);
    continue;
  }
  console.log(`${a.email} | rol=${a.rol} | pass=${password}`);
}
