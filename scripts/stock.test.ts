import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buy, createAccount, creditCash } from '../src/logic/ledger.ts';
import { receiveBar, withdrawPhysical } from '../src/logic/physical.ts';
import { addStock, adjustStock, parseSerials, stockCount, stockSummary } from '../src/logic/stock.ts';

const p = { gold: 100, silver: 1, platinum: 30 };
const base = () => creditCash(buy(createAccount('T'), p, 'gold', { unit: 'g', value: 100 }), 500);

test('stock : lots par quantité, au coffre de la société ou en coffre professionnel', () => {
  let a = base();
  a = addStock(a, { product: 'g10', qty: 100, source: 'maison', unitCost: 1199.83 });
  a = addStock(a, { product: 'g10', qty: 10, source: 'pro', vault: 'Gold Avenue' });
  a = addStock(a, { product: 'nap20', qty: 50, source: 'maison' });
  assert.deepEqual(stockCount(a, 'g10'), { maison: 100, pro: 10 });
  assert.equal(stockSummary(a).length, 2);
  assert.equal(a.stockLog!.length, 3);
  assert.equal(a.stock![1].vault, 'Gold Avenue');
  assert.throws(() => addStock(a, { product: 'g10', qty: 0, source: 'maison' }));
  assert.throws(() => addStock(a, { product: 'g10', qty: 1.5, source: 'maison' }));
  assert.throws(() => addStock(a, { product: 'g10', qty: 20000, source: 'maison' }));
});

test('stock : numéros de série connus, format PAMP, doublons refusés', () => {
  assert.deepEqual(parseSerials('C123456\nC123457, C123458;  \n'), ['C123456', 'C123457', 'C123458']);
  let a = base();
  a = addStock(a, { product: 'g10', qty: 3, source: 'maison', serials: ['c123456', 'C 123457'] });
  assert.deepEqual(a.stock![0].serials, ['C123456', 'C123457']); // le troisième sera noté à l'expédition
  assert.throws(() => addStock(a, { product: 'g10', qty: 2, source: 'maison', serials: ['C123456'] }), /déjà/);
  assert.throws(
    () => addStock(a, { product: 'g10', qty: 2, source: 'maison', serials: ['C1', 'C2'] }),
    /format|PAMP|C/,
  );
  assert.throws(
    () => addStock(a, { product: 'g10', qty: 1, source: 'maison', serials: ['C111111', 'C222222'] }),
    /trop/,
  );
  assert.throws(
    () => addStock(a, { product: 'g10', qty: 2, source: 'maison', serials: ['C333333', 'C333333'] }),
    /déjà/,
  );
  // Les millésimes d'une pièce se répètent : pas de contrôle de doublon.
  addStock(a, { product: 'nap20', qty: 2, source: 'maison', serials: ['1910', '1910'] });
});

test('stock : un retrait prend dans le stock de la société, puis le coffre professionnel, sinon commande', () => {
  let a = base();
  a = addStock(a, { product: 'g10', qty: 2, source: 'maison', serials: ['C100001', 'C100002'] });
  a = addStock(a, { product: 'g10', qty: 1, source: 'pro', vault: 'Gold Avenue' });
  a = withdrawPhysical(a, p, { g10: 4 }, new Date('2026-11-16T12:00:00'));
  const origins = a.homeVault!.map((b) => b.origin);
  assert.deepEqual(origins, ['maison', 'maison', 'pro', 'commande']);
  assert.equal(a.homeVault![0].expectedSerial, 'C100001');
  assert.equal(a.homeVault![1].expectedSerial, 'C100002');
  assert.equal(a.homeVault![2].expectedSerial, undefined);
  assert.deepEqual(stockCount(a, 'g10'), { maison: 0, pro: 0 });
  assert.ok(a.stockLog![0].kind === 'out' && a.stockLog![0].qty < 0);
  // Le numéro prévu est confirmé à la réception.
  a = receiveBar(a, a.homeVault![0].id, 'C100001');
  assert.equal(a.homeVault![0].serial, 'C100001');
});

test('stock : sans stock, le retrait marche comme avant', () => {
  let a = base();
  a = withdrawPhysical(a, p, { g5: 1 });
  assert.equal(a.homeVault![0].origin, 'commande');
  assert.equal(a.stock, undefined);
});

test('stock : inventaire, l’écart est noté au journal', () => {
  let a = addStock(base(), { product: 'g20', qty: 10, source: 'maison', serials: ['C200001', 'C200002', 'C200003'] });
  const id = a.stock![0].id;
  a = adjustStock(a, id, 8);
  assert.equal(a.stock![0].qty, 8);
  assert.equal(a.stockLog![0].kind, 'adjust');
  assert.equal(a.stockLog![0].qty, -2);
  a = adjustStock(a, id, 2); // moins d'exemplaires que de numéros connus : les derniers numéros sortent
  assert.equal(a.stock![0].serials!.length, 2);
  assert.throws(() => adjustStock(a, id, -1));
  assert.equal(adjustStock(a, id, 2), a);
});
