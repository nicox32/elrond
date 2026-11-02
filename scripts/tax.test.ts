// Tests de l'estimation fiscale à la revente. Lancer : npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FEES } from '../src/logic/fees.ts';
import { buy, createAccount, sell } from '../src/logic/ledger.ts';
import { estimateTax, fullYears, holdingAllowance, holdingLots, TAX } from '../src/logic/tax.ts';

const close = (a: number, b: number, eps = 0.02) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('abattement : rien les 2 premières années, 5 % par an ensuite, exonération après 22 ans', () => {
  assert.equal(holdingAllowance(0), 0);
  assert.equal(holdingAllowance(2), 0);
  close(holdingAllowance(3), 0.05, 1e-9);
  close(holdingAllowance(5), 0.15, 1e-9);
  close(holdingAllowance(21), 0.95, 1e-9);
  assert.equal(holdingAllowance(22), 1);
  assert.equal(holdingAllowance(30), 1);
  assert.equal(fullYears(new Date('2021-01-05'), new Date('2026-01-04')), 4);
  assert.equal(fullYears(new Date('2021-01-05'), new Date('2026-01-05')), 5);
});

test('lots en premier entré, premier sorti', () => {
  let acc = buy(
    createAccount('T'),
    { gold: 100, silver: 1, platinum: 30 },
    'gold',
    { unit: 'g', value: 10 },
    new Date('2021-01-05'),
  );
  acc = buy(acc, { gold: 200, silver: 1, platinum: 30 }, 'gold', { unit: 'g', value: 10 }, new Date('2025-01-05'));
  acc = sell(
    acc,
    { gold: 200, silver: 1, platinum: 30 },
    'gold',
    { unit: 'g', value: 15 },
    'deferred',
    new Date('2025-06-01'),
  );
  const lots = holdingLots(acc).gold;
  assert.equal(lots.length, 1);
  close(lots[0].grams, 5, 1e-6);
  assert.equal(lots[0].date.slice(0, 10), '2025-01-05');
});

test('impôt : le régime le moins cher est retenu, plus-value en euros et en %', () => {
  const now = new Date('2026-11-02');
  // 1 000 € d'or achetés en 2021 à 100 €/g, revendus à 300 €/g : forte plus-value, 5 ans de détention
  const acc = buy(
    createAccount('T'),
    { gold: 100, silver: 1, platinum: 30 },
    'gold',
    { unit: 'eur', value: 1000 },
    new Date('2021-06-01'),
  );
  const est = estimateTax(acc, { gold: 300, silver: 1, platinum: 30 }, now);
  const g = est.metals[0];
  const value = acc.holdings.gold * 300 * (1 - FEES.sale);
  close(g.value, value);
  close(g.cost, 1000);
  close(g.gain, value - 1000);
  close(g.gainPercent, ((value - 1000) / 1000) * 100);
  close(g.flatTax, value * 0.115);
  close(g.gainTax, (value - 1000) * 0.85 * 0.376); // 15 % d'abattement
  assert.equal(g.best, g.gainTax < g.flatTax ? 'gain' : 'flat');
  close(est.tax, Math.min(g.flatTax, g.gainTax));
  close(est.netGain, value - est.tax - 1000);

  // Moins-value : 0 € au régime des plus-values, qui l'emporte sur la taxe forfaitaire
  const loss = estimateTax(acc, { gold: 80, silver: 1, platinum: 30 }, now);
  assert.equal(loss.metals[0].best, 'gain');
  assert.equal(loss.tax, 0);
  assert.ok(loss.gain < 0);

  // Faible plus-value récente : la plus-value à 37,6 % reste moins chère que 11,5 % du prix de vente
  const recent = buy(
    createAccount('T'),
    { gold: 100, silver: 1, platinum: 30 },
    'gold',
    { unit: 'eur', value: 1000 },
    new Date('2026-01-01'),
  );
  const r = estimateTax(recent, { gold: 110, silver: 1, platinum: 30 }, now).metals[0];
  assert.equal(r.best, 'gain');
  close(TAX.flat + 0, 0.115, 1e-9);
});
