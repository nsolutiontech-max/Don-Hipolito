// Rota passwords y crea a Leo. Uso: node scripts/rotar-passwords.mjs <ruta-pw.json>
// El archivo de passwords se borra después de usar. Nunca commitear credenciales.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}
const pw = JSON.parse(readFileSync(process.argv[2], "utf8"));

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: resps } = await db.from("responsables").select("id,nombre");
const respId = Object.fromEntries((resps ?? []).map((r) => [r.nombre, r.id]));

const PLAN = [
  { email: "Guille@donhipolito.com", rol: "DUEÑO", responsable: null, crear: false },
  { email: "nico@donhipolito.com", rol: "ENCARGADO", responsable: "Nicolas", crear: false },
  { email: "namir@donhipolito.com", rol: "ENCARGADO", responsable: "Namir", crear: false },
  { email: "leo@donhipolito.com", rol: "ENCARGADO", responsable: "Leo", crear: true },
];

const { data: lista } = await db.auth.admin.listUsers();
// Auth normaliza emails: comparar en minúsculas.
const porEmail = Object.fromEntries(
  (lista?.users ?? []).map((u) => [(u.email ?? "").toLowerCase(), u.id]),
);

for (const p of PLAN) {
  const pass = pw[p.email];
  if (!pass) {
    console.log(`${p.email}: sin password, salto`);
    continue;
  }
  let id = porEmail[p.email.toLowerCase()];
  if (!id && p.crear) {
    const { data, error } = await db.auth.admin.createUser({
      email: p.email,
      password: pass,
      email_confirm: true,
    });
    if (error) {
      console.log(`${p.email}: CREATE ERROR ${error.message}`);
      continue;
    }
    id = data.user.id;
    const { error: e2 } = await db.from("usuarios").insert({
      id,
      email: p.email,
      rol: p.rol,
      responsable_id: p.responsable ? (respId[p.responsable] ?? null) : null,
    });
    if (e2) {
      console.log(`${p.email}: USUARIOS ERROR ${e2.message}`);
      continue;
    }
    console.log(`${p.email}: creado OK rol=${p.rol}`);
  } else if (!id) {
    console.log(`${p.email}: no existe y no está marcado para crear`);
    continue;
  } else {
    const { error } = await db.auth.admin.updateUserById(id, { password: pass });
    if (error) {
      console.log(`${p.email}: ROTATE ERROR ${error.message}`);
      continue;
    }
    console.log(`${p.email}: password rotado OK`);
  }
}
