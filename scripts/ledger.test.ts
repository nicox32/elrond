// Tests de la logique du compte. Lancer : npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  accountValue,
  convert,
  createAccount,
  deposit,
  LedgerError,
  SPREAD,
  transfer,
  withdraw,
} from '../src/logic/ledger.ts';
import { nextPrices } from '../src/logic/prices.ts';

const prices = { gold: 100, silver: 1 };
const close = (a: number, b: number, eps = 1e-4) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('un dépôt est réparti entre or et argent selon la répartition', () => {
  const acc = deposit({ ...createAccount('Test'), goldAllocation: 70 }, prices, 1000);
  close(acc.goldGrams, 700 / (100 * (1 + SPREAD)));
  close(acc.silverGrams, 300 / (1 + SPREAD));
  assert.equal(acc.transactions.length, 1);
  assert.equal(acc.transactions[0].kind, 'deposit');
});

test('dépôt puis retrait total coûte exactement l’écart', () => {
  let acc = deposit(createAccount('Test'), prices, 1000);
  const value = accountValue(acc, prices).total;
  close(value, (1000 * (1 - SPREAD)) / (1 + SPREAD), 1e-3);
  acc = withdraw(acc, prices, value);
  close(acc.goldGrams, 0);
  close(acc.silverGrams, 0);
});

test('retrait supérieur au solde refusé', () => {
  const acc = deposit(createAccount('Test'), prices, 100);
  assert.throws(() => withdraw(acc, prices, 200), LedgerError);
  assert.throws(() => withdraw(acc, prices, 50, 'silver'), LedgerError);
});

test('montants invalides refusés', () => {
  const acc = createAccount('Test');
  assert.throws(() => deposit(acc, prices, 0), LedgerError);
  assert.throws(() => deposit(acc, prices, Number.NaN), LedgerError);
  assert.throws(() => deposit(acc, prices, -5), LedgerError);
});

test('conversion or → argent', () => {
  let acc = deposit({ ...createAccount('Test'), goldAllocation: 100 }, prices, 1000);
  const gold = acc.goldGrams;
  acc = convert(acc, prices, 'gold', 1);
  close(acc.goldGrams, gold - 1);
  close(acc.silverGrams, (100 * (1 - SPREAD)) / (1 + SPREAD));
});

test('virement de métal sans frais, bénéficiaire obligatoire', () => {
  let acc = deposit({ ...createAccount('Test'), goldAllocation: 0 }, prices, 100);
  const silver = acc.silverGrams;
  assert.throws(() => transfer(acc, prices, 'silver', 1, '  '), LedgerError);
  acc = transfer(acc, prices, 'silver', 10, 'Alice');
  close(acc.silverGrams, silver - 10);
  assert.equal(acc.transactions[0].label, 'Virement à Alice');
});

test('les cours restent positifs', () => {
  let p = prices;
  for (let i = 0; i < 10000; i++) p = nextPrices(p);
  assert.ok(p.gold > 0 && p.silver > 0);
});
