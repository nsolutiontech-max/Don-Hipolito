// Run against a production server on port 3011. Fixtures use an unused future date and are removed.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { environment } from './db.mjs';

async function scenario(page, credentials, role, date, base, screenshots, smokeProduct, smokeEmail) {
  const ensure = (condition, message) => { if (!condition) throw new Error(message); };
  await page.context().clearCookies();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/login`);
  await page.getByLabel('Email', { exact: true }).fill(credentials.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL(`${base}/hoy`);
  await page.getByRole('heading', { name: 'La operación de hoy' }).waitFor();
  ensure(!/Mediodía|Noche/.test(await page.locator('main').innerText()), 'Shift selector must not exist');
  await page.goto(`${base}/stock`);
  await page.getByRole('heading', { name: 'Stock y reposición' }).waitFor();
  ensure(await page.locator('main a[href^="/conteo/"]').count() === (role === 'CAMARERO' ? 1 : 4), 'Incorrect inventory navigation permissions');
  if (role === 'CAMARERO') {
    for (const path of ['/admin', '/movimientos', '/pedidos', '/conteo/stock-a/hoy', '/tareas/cocina/hoy']) {
      await page.goto(`${base}${path}`);
      await page.waitForURL(url => ['/hoy', '/tareas'].includes(url.pathname));
    }
  }
  const code = role === 'CAMARERO' ? 'bebidas' : 'stock-a';
  await page.goto(`${base}/conteo/${code}/${date}`);
  const first = page.locator('article').first();
  if (role === 'CAMARERO') {
    await first.getByLabel('Depósito', { exact: true }).fill('0');
    await first.getByLabel('Heladera', { exact: true }).fill('5');
  } else {
    await first.getByLabel('Stock', { exact: true }).fill('2,5');
    await first.getByLabel('Pedir', { exact: true }).fill('1/2');
  }
  await page.getByRole('button', { name: 'Guardar inventario', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Inventario guardado' }).waitFor();
  await page.reload();
  await first.getByLabel(role === 'CAMARERO' ? 'Depósito' : 'Stock', { exact: true }).waitFor();
  ensure(await first.getByLabel(role === 'CAMARERO' ? 'Depósito' : 'Stock', { exact: true }).inputValue() === (role === 'CAMARERO' ? '0' : '2.5'), 'Saved stock did not survive reload');
  if (screenshots) await page.screenshot({ path: `${screenshots}/${role.toLowerCase()}-stock-mobile.png` });
  if (role === 'ENCARGADO') {
    await first.getByLabel('Stock', { exact: true }).fill('7');
    await page.waitForFunction(() => Object.keys(localStorage).some(key => key.startsWith('hipolito:v2:')));
    await page.reload();
    await page.getByRole('button', { name: 'Recuperar borrador' }).click();
    ensure(await first.getByLabel('Stock', { exact: true }).inputValue() === '7', 'Unsaved draft was not restored');
    await first.getByLabel('Stock', { exact: true }).fill('-1');
    await page.getByRole('button', { name: 'Guardar inventario', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'cantidades no válidas' }).waitFor();
    await first.getByLabel('Stock', { exact: true }).fill('7');
    await page.getByRole('button', { name: 'Generar pedido', exact: true }).click();
    await page.waitForURL(`${base}/pedidos?pedido=*`);
    await page.getByRole('heading', { name: 'Pedidos guardados' }).waitFor();
    ensure((await page.locator('pre').first().innerText()).includes('0.5'), 'Order did not use the persisted quantity');
    const card = page.locator('article').first();
    await card.getByRole('button', { name: 'Marcar enviado', exact: true }).click();
    await card.getByText('ENVIADO', { exact: true }).waitFor();
    await card.getByRole('button', { name: 'Marcar recibido', exact: true }).click();
    await card.getByText('RECIBIDO', { exact: true }).waitFor();
    await page.reload();
    await page.locator('article').first().getByText('RECIBIDO', { exact: true }).waitFor();
  }
  await page.goto(`${base}/tareas/salon/${date}`);
  const task = page.locator('article').first();
  await task.getByLabel('Hora realizada').fill('19:23');
  await task.getByRole('button', { name: /Completar tarea|Actualizar registro/ }).click();
  await task.getByText('Hecha', { exact: true }).waitFor();
  await page.reload();
  await task.getByText('Hecha', { exact: true }).waitFor();
  ensure(await task.getByLabel('Hora realizada').inputValue() === '19:23', 'Task time did not survive reload');
  await page.getByText(/1 \/ \d+ actividades registradas/).waitFor();
  await page.getByRole('progressbar', { name: 'Progreso de tareas' }).waitFor();
  await page.goto(`${base}/hoy`);
  await page.getByRole('progressbar', { name: /Progreso de tareas de (Salón|Cocina)/ }).first().waitFor();
  if (role === 'DUEÑO') {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/auditorias/${date}`);
    await page.getByRole('heading', { name: 'Auditoría diaria' }).waitFor();
    await page.locator('details > summary').first().click();
    await page.getByLabel('Observaciones generales', { exact: false }).first().fill('Detalle de prueba');
    await page.getByRole('button', { name: 'Guardar borrador' }).click();
    await page.getByText('Auditoría guardada').waitFor();
    await page.reload();
    ensure(await page.getByRole('button', { name: 'NO OK', exact: true }).first().getAttribute('aria-pressed') === 'false',
      'Audit draft reset selections unexpectedly');
    for (const block of ['COCINA', 'SALON_GENERAL']) {
      if (block === 'SALON_GENERAL') await page.getByRole('tab', { name: /Salón \/ General/ }).click();
      await page.evaluate(() => [...document.querySelectorAll('button')]
        .filter(button => button.textContent?.trim() === 'OK' && button.getAttribute('aria-pressed') === 'false')
        .forEach(button => button.click()));
    }
    await page.getByRole('button', { name: 'NO OK', exact: true }).last().click();
    await page.getByLabel('Firma / aclaración', { exact: true }).fill('Auditoría de prueba');
    await page.getByRole('button', { name: 'Cerrar auditoría' }).click();
    await page.getByRole('button', { name: /Confirmar cierre/ }).click();
    await page.getByText('Auditoría cerrada correctamente').waitFor();
    await page.reload();
    ensure((await page.locator('main').innerText()).includes('Puntaje 83/84'), 'Closed audit did not preserve score');
    if (screenshots) await page.screenshot({ path: `${screenshots}/dueno-auditoria-mobile.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/entrevistas`);
    await page.getByLabel('Candidato', { exact: true }).fill('Candidato de prueba');
    await page.getByLabel('Puesto al que aspira', { exact: true }).fill('Cocina');
    await page.getByRole('button', { name: 'Crear evaluación' }).click();
    await page.waitForURL(/\/entrevistas\/[0-9a-f-]{36}$/);
    await page.getByRole('heading', { name: 'Entrevista práctica' }).waitFor();
    await page.getByRole('button', { name: 'Sí', exact: true }).first().click();
    await page.getByRole('combobox', { name: 'Técnica actual', exact: true }).selectOption('4');
    await page.getByRole('button', { name: 'Guardar evaluación', exact: true }).click();
    await page.getByText('Evaluación guardada.').waitFor();
    await page.reload();
    ensure(await page.getByRole('button', { name: 'Sí', exact: true }).first().getAttribute('aria-pressed') === 'true',
      'Interview response did not survive reload');
    if (screenshots) await page.screenshot({ path: `${screenshots}/dueno-entrevista-mobile.png` });
    await page.goto(`${base}/admin/catalogo`);
    await page.getByRole('heading', { name: 'Catálogo de productos' }).waitFor();
    await page.getByPlaceholder('Buscar por nombre o categoría…').fill(smokeProduct);
    const row = page.locator('article').first();
    ensure(await row.getByLabel('Nombre').inputValue() === smokeProduct, 'Catalogue filter did not isolate the fixture product');
    await row.getByLabel('Unidad').selectOption('UN');
    await row.getByLabel('Stock ideal (vacío = sin definir)').fill('5');
    await row.getByRole('button', { name: 'Guardar cambios' }).click();
    await row.getByText('Producto actualizado.').waitFor();
    await page.reload();
    await page.getByPlaceholder('Buscar por nombre o categoría…').fill(smokeProduct);
    ensure(await row.getByLabel('Unidad').inputValue() === 'UN', 'Catalogue unit did not survive reload');
    ensure(await row.getByLabel('Stock ideal (vacío = sin definir)').inputValue() === '5', 'Catalogue target did not survive reload');
    await row.getByText('objetivo confirmado').waitFor();
    if (screenshots) await page.screenshot({ path: `${screenshots}/dueno-catalogo-mobile.png` });
    await page.goto(`${base}/admin/usuarios`);
    await page.getByRole('heading', { name: 'Gestión de usuarios' }).waitFor();
    ensure(await page.locator('article').count() >= 5, 'User list is incomplete');
    await page.locator('input[name="email"]').fill(smokeEmail);
    await page.locator('select[name="rol"]').selectOption('ENCARGADO');
    await page.locator('select[name="responsableId"]').selectOption({ label: 'Camarero' });
    await page.getByRole('button', { name: 'Crear acceso' }).click();
    const newCard = page.locator('article').filter({ hasText: smokeEmail });
    await newCard.waitFor({ timeout: 15000 });
    const shown = (await newCard.locator('code').textContent()) || '';
    ensure(shown.trim().length >= 8, 'One-time password was not displayed');
    await newCard.getByRole('button', { name: 'Resetear contraseña' }).click();
    await newCard.locator('code', { hasNotText: shown.trim() }).waitFor({ timeout: 15000 });
    await newCard.getByRole('button', { name: 'Desactivar' }).click();
    await newCard.getByText('Inactivo').waitFor({ timeout: 15000 });
    if (screenshots) await page.screenshot({ path: `${screenshots}/dueno-usuarios-mobile.png` });
  }
  // Owner-only closure and reopen of the daily sheet.
  if (role === 'DUEÑO') {
    await page.goto(`${base}/conteo/stock-a/${date}`);
    await page.getByRole('button', { name: 'Cerrar día', exact: true }).click();
    await page.getByText('Planilla cerrada', { exact: false }).waitFor({ timeout: 15000 });
    ensure(await page.getByRole('button', { name: 'Guardar inventario', exact: true }).isDisabled(), 'Closed inventory still offered saving');
    await page.getByLabel('Motivo de reapertura', { exact: false }).fill('Verificación puntual del recuento de la planilla');
    await page.getByRole('button', { name: 'Reabrir día', exact: true }).click();
    await page.getByRole('button', { name: 'Cerrar día', exact: true }).waitFor({ timeout: 15000 });
  }
  ensure(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Horizontal overflow on mobile');
  await page.setViewportSize({ width: 1280, height: 900 });
  ensure(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Horizontal overflow on desktop');
  await page.goto(`${base}/mas`);
  await page.getByRole('button', { name: 'Salir', exact: true }).last().click();
  await page.waitForURL(`${base}/login`);
  ensure(await page.evaluate(() => !Object.keys(localStorage).some(key => key.startsWith('hipolito'))), 'Logout retained a local draft');
  return `${role}: login, permissions, daily save/reload, tasks with progress, responsive layout and logout passed`;
}

const env = environment();
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const cli = env.PLAYWRIGHT_CLI_JS || join(env.APPDATA, 'npm/node_modules/@playwright/cli/playwright-cli.js');
const temp = mkdtempSync(join(env.LOCALAPPDATA, 'Temp/opencode/hipolito-smoke-'));
let temporaryUsers = [];
const date = `2099-11-${String(1 + randomBytes(1)[0] % 28).padStart(2, '0')}`;
const smokeProduct = `ZZ Smoke ${randomBytes(4).toString('hex')}`;
const smokeEmail = `ui-smoke-${randomBytes(4).toString('hex')}@donhipolito.com`;
const checked = async promise => { const result = await promise; if (result.error) throw result.error; return result.data; };
let reserved = false;
try {
  const inventories = await checked(admin.from('inventarios').select('id').eq('fecha', date));
  const records = await checked(admin.from('actividad_registros').select('id').eq('fecha', date));
  const audits = await checked(admin.from('auditorias').select('id').eq('fecha', date));
  if (inventories.length || records.length || audits.length) throw new Error('Fixture date already contains records; no test changes made');
  reserved = true;
  let encargado; let dueno;
  for (const role of ['ENCARGADO', 'DUEÑO']) {
    const password = randomBytes(24).toString('base64url');
    const email = `browser-${randomBytes(8).toString('hex')}@donhipolito.com`;
    const account = await checked(admin.auth.admin.createUser({ email, password, email_confirm: true }));
    temporaryUsers.push(account.user.id);
    await checked(admin.from('usuarios').insert({ id: account.user.id, email, rol: role }));
    if (role === 'ENCARGADO') encargado = { email, password };
    if (role === 'DUEÑO') dueno = { email, password };
  }
  const bebidas = await checked(admin.from('categorias').select('id').eq('nombre', 'Bebidas').single());
  await checked(admin.from('productos').insert({ categoria_id: bebidas.id, nombre: smokeProduct,
    unidad_medida: 'POR_DEFINIR', stock_minimo: 0, stock_ideal: null, activo: true }));
  for (const [role, credentials] of [['CAMARERO', { email: env.CAMARERO_EMAIL, password: env.CAMARERO_SMOKE_PASSWORD || env.CAMARERO_TEMP_PASSWORD }], ['ENCARGADO', encargado], ['DUEÑO', dueno]]) {
    const file = join(temp, 'scenario.js');
    writeFileSync(file, `async page => { const scenario = ${scenario.toString()}; return scenario(page, ${JSON.stringify(credentials)}, ${JSON.stringify(role)}, ${JSON.stringify(date)}, ${JSON.stringify(env.SMOKE_BASE_URL || 'http://localhost:3011')}, ${JSON.stringify(env.SMOKE_SCREENSHOT_DIR || null)}, ${JSON.stringify(smokeProduct)}, ${JSON.stringify(smokeEmail)}); }`, { mode: 0o600 });
    const output = execFileSync(process.execPath, [cli, '-s=hipolito', '--raw', 'run-code', `--filename=${file}`], { cwd: temp, encoding: 'utf8', timeout: 120000 });
    console.log(output);
    if (!output.includes(`${role}: login, permissions`)) throw new Error('Browser scenario did not complete');
  }
} finally {
  if (reserved) {
    const inventories = await checked(admin.from('inventarios').select('id').eq('fecha', date));
    const inventoryIds = inventories.map(i => i.id);
    if (inventoryIds.length) {
      const orders = await checked(admin.from('pedidos').select('id').in('inventario_id', inventoryIds));
      if (orders.length) {
        await checked(admin.from('pedido_items').delete().in('pedido_id', orders.map(order => order.id)));
        await checked(admin.from('pedidos').delete().in('id', orders.map(order => order.id)));
      }
      await checked(admin.from('inventario_detalles').delete().in('inventario_id', inventoryIds));
      await checked(admin.from('inventarios').delete().in('id', inventoryIds));
    }
    await checked(admin.from('auditorias').delete().eq('fecha', date));
    if (temporaryUsers.length) await checked(admin.from('entrevistas').delete().in('evaluador_id', temporaryUsers));
    await checked(admin.from('actividad_registros').delete().eq('fecha', date));
    await checked(admin.from('productos').delete().eq('nombre', smokeProduct));
  }
  const { data: listed } = await admin.auth.admin.listUsers();
  const uiUser = listed?.users?.find(user => user.email === smokeEmail);
  if (uiUser) await checked(admin.auth.admin.deleteUser(uiUser.id));
  for (const id of temporaryUsers) await checked(admin.auth.admin.deleteUser(id));
  rmSync(temp, { recursive: true, force: true });
}
