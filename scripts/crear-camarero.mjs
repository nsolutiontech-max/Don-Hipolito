// Provision once. Never print or commit the generated password.
import { appendFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { environment } from './db.mjs';

const env = environment();
if (!env.NEXT_PUBLIC_SUPABASE_URL?.includes('rceoboibijmwtxmevash')) throw new Error('Unexpected Supabase project');
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const email = env.CAMARERO_EMAIL || 'camarero@donhipolito.com';
const { data: existing, error: lookupError } = await db.from('usuarios').select('id,rol').eq('email', email).maybeSingle();
if (lookupError) throw lookupError;
if (existing) {
  if (existing.rol !== 'CAMARERO') throw new Error('Existing account has a different role; no changes made');
  console.log('CAMARERO already exists; password unchanged.');
} else {
  const password = randomBytes(24).toString('base64url');
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`Account not created: ${error.message}`);
  try {
    const { data: responsible, error: responsibleError } = await db.from('responsables')
      .upsert({ nombre: 'Camarero', activo: true }, { onConflict: 'nombre' }).select('id').single();
    if (responsibleError) throw responsibleError;
    const { error: profileError } = await db.from('usuarios').insert({ id: data.user.id, email, rol: 'CAMARERO', responsable_id: responsible.id });
    if (profileError) throw profileError;
    appendFileSync('.env.local', `\nCAMARERO_EMAIL=${email}\nCAMARERO_TEMP_PASSWORD=${password}\n`);
    console.log('CAMARERO created. Temporary credentials are in ignored .env.local (CAMARERO_EMAIL / CAMARERO_TEMP_PASSWORD).');
  } catch (error) {
    const rollback = await db.auth.admin.deleteUser(data.user.id);
    if (rollback.error) console.error('Account cleanup requires administrator attention.');
    throw error;
  }
}
