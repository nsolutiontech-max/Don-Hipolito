import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Test pure TypeScript without adding a second compiler/runtime dependency.
async function moduleFrom(path) {
  const { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const permissions = await moduleFrom('lib/permissions.ts');
const dates = await moduleFrom('lib/dates.ts');
const calculations = await moduleFrom('lib/calculations.ts');
const quantities = await moduleFrom('lib/quantity-parse.ts');
const whatsapp = await moduleFrom('lib/whatsapp.ts');
const inventoryHistory = await moduleFrom('lib/inventory-history.ts');

test('CAMARERO is scoped to beverages; operators retain all stock sheets', () => {
  for (const code of ['STOCK_A', 'STOCK_B', 'STOCK_C', 'BEBIDAS']) {
    assert.equal(permissions.canAccessSheet('CAMARERO', code), code === 'BEBIDAS');
    assert.equal(permissions.canAccessSheet('ENCARGADO', code), true);
    assert.equal(permissions.canAccessSheet('DUEÑO', code), true);
  }
  assert.equal(permissions.canOperate('CAMARERO'), false);
});
test('sheet slug round-trips and unknown paths are rejected', () => {
  assert.equal(permissions.parseSheetCode(permissions.sheetSlug('STOCK_A')), 'STOCK_A');
  assert.equal(permissions.parseSheetCode('compras'), null);
});
test('business date follows Argentina, not the server UTC date', () => {
  assert.equal(dates.fechaHoy(new Date('2026-10-27T01:30:00Z')), '2026-10-26');
  assert.equal(dates.fechaHoy(new Date('2026-10-27T04:30:00Z')), '2026-10-27');
});
test('quantities support decimal comma, fractions and zero', () => {
  for (const [text, expected] of [['2,5', 2.5], ['1/2', 0.5], ['3 1/2', 3.5], ['0', 0], ['', null], ['-1', null], ['NaN', null], ['1/0', null], ['0x10', null], ['1e3', null]]) {
    assert.equal(quantities.parsearCantidad(text), expected);
  }
});
test('suggested quantity never invents an ideal or an uncounted stock', () => {
  assert.equal(calculations.cantidadSugerida(null, 5), 0);
  assert.equal(calculations.cantidadSugerida(5, null), 0);
  assert.equal(calculations.cantidadSugerida(5, 2.5), 2.5);
  assert.equal(calculations.cantidadSugerida(2, 5), 0);
});
test('history counts only products complete in every required location', () => {
  const details = [
    { producto_id: 'a', stock_real: 0 }, { producto_id: 'b', stock_real: 3 },
    { producto_id: 'b', stock_real: null }, { producto_id: 'c', stock_real: 1 },
    { producto_id: 'c', stock_real: 2 },
  ];
  assert.equal(inventoryHistory.contarArticulosCompletos(details, 1), 3);
  assert.equal(inventoryHistory.contarArticulosCompletos(details, 2), 1);
  assert.equal(inventoryHistory.contarArticulosCompletos([], 1), 0);
  assert.equal(inventoryHistory.contarArticulosCompletos(details, 0), 0);
});
test('history status prioritizes closing over completeness', () => {
  assert.equal(inventoryHistory.estadoInventario('CERRADO', 0, 10), 'CERRADO');
  assert.equal(inventoryHistory.estadoInventario('ABIERTO', 10, 10), 'COMPLETO');
  assert.equal(inventoryHistory.estadoInventario('ABIERTO', 9, 10), 'PARCIAL');
  assert.equal(inventoryHistory.estadoInventario('ABIERTO', 0, 0), 'PARCIAL');
});
test('WhatsApp contains the date, presentation and no shift', () => {
  const message = whatsapp.armarMensajePedido([{ producto: { nombre: 'Coca-Cola', presentacion: '350 cc', unidad_medida: 'UN' },
    categoria: { id: 'a', nombre: 'Bebidas' }, cantidad: 5 }], '27/10/2026');
  assert.match(message, /27\/10\/2026/);
  assert.match(message, /350 cc/);
  assert.doesNotMatch(message, /MEDIODIA|NOCHE|undefined/);
});
