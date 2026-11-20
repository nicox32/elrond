import assert from 'node:assert/strict';
import test from 'node:test';

import { formatDay, lotPriceOf, parseDay, sheetResult } from '../src/logic/godotCalc.ts';
import { LedgerError } from '../src/logic/ledger.ts';
import { lotUnitCost, physicalFeesOf } from '../src/logic/physical.ts';
import { addStock } from '../src/logic/stock.ts';
import { createAccount } from '../src/logic/ledger.ts';

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

test('calculateur Godot & Fils : prime de base et remises déduites du relevé de prix et du cours de l’or', () => {
  // Relevé du lingotin 10 g : 1 191 / 1 185 / 1 182 / 1 173 € pour un or à 111,808 €/g (valeur 1 118,08 €).
  const sheet = {
    productId: 'g10',
    gold: 111.808,
    prices: [1191, 1185, 1182, 1173] as [number, number, number, number],
  };
  const r = sheetResult(sheet);
  close(r.premium, 1191 / 1118.08 - 1, 1e-5); // ≈ 6,52 %
  close(r.offs[0], 6 / 1118.08, 1e-5); // ≈ 0,54 point
  close(r.offs[1], 9 / 1118.08, 1e-5); // ≈ 0,80 point
  close(r.offs[2], 18 / 1118.08, 1e-5); // ≈ 1,61 point
  close(r.metalValue, 1118.08, 1e-6);
  assert.deepEqual(r.warnings, []);
  // Le prix d'un lot selon sa taille : 9 → base, 10 à 19, 20 à 49, 50 et plus.
  assert.equal(lotPriceOf(sheet, 9), 1191);
  assert.equal(lotPriceOf(sheet, 10), 1185);
  assert.equal(lotPriceOf(sheet, 19), 1185);
  assert.equal(lotPriceOf(sheet, 20), 1182);
  assert.equal(lotPriceOf(sheet, 49), 1182);
  assert.equal(lotPriceOf(sheet, 50), 1173);
  assert.equal(lotPriceOf(sheet, 500), 1173);
  // Les valeurs calculées règlent le prix attendu d'un lot : on retrouve les prix du relevé (au cours du relevé).
  const base = physicalFeesOf();
  const fees = {
    ...base,
    vendor: { ...base.vendor, g10: r.premium },
    vendorTiers: { ...base.vendorTiers, g10: [10, 20, 50].map((from, i) => ({ from, off: r.offs[i] })) },
  };
  close(lotUnitCost('g10', 20, 111.808, fees), 1182, 0.01);
  close(lotUnitCost('g10', 50, 111.808, fees), 1173, 0.01);
  close(lotUnitCost('g10', 3, 111.808, fees), 1191, 0.01);
  // Mêmes remises appliquées à un autre cours de l'or : le prix suit l'or.
  close(lotUnitCost('g10', 20, 120, fees), 10 * 120 * (1 + r.premium - r.offs[1]), 1e-6);
});

test('calculateur Godot & Fils : prix absurdes, prix de tranche plus élevé, dates', () => {
  assert.throws(() => sheetResult({ productId: 'g10', gold: 0, prices: [1, 1, 1, 1] }), LedgerError);
  assert.throws(() => sheetResult({ productId: 'g10', gold: 111, prices: [1191, 0, 1182, 1173] }), /quatre tranches/);
  assert.throws(
    () => sheetResult({ productId: 'g10', gold: 111, prices: [3000, 2900, 2800, 2700] }),
    /loin de la valeur/,
  );
  const warn = sheetResult({ productId: 'g10', gold: 111.808, prices: [1191, 1195, 1182, 1173] });
  assert.equal(warn.warnings.length, 1);
  assert.equal(warn.offs[0], 0);
  const now = new Date('2026-11-18T10:00:00');
  assert.equal(formatDay(parseDay('5/11/2026', now)), '05/11/2026');
  assert.throws(() => parseDay('31/02/2026', now), /n’existe pas/);
  assert.throws(() => parseDay('01/12/2026', now), /futur/);
  assert.throws(() => parseDay('hier', now), /JJ\/MM\/AAAA/);
  // Un lot enregistré à la date du relevé garde son cours de l'or et sa date d'achat.
  const when = parseDay('05/11/2026', now);
  const acc = addStock(
    createAccount('T', new Date('2020-01-01')),
    { product: 'g10', qty: 20, source: 'pro', vault: 'Godot & Fils', unitCost: 1182, goldPrice: 111.808 },
    when,
  );
  assert.equal(acc.stock![0].addedAt.slice(0, 10), '2026-11-05');
  assert.equal(acc.stock![0].goldPriceAtEntry, 111.808);
  assert.equal(acc.stock![0].unitCost, 1182);
});

test('calculateur : le 20 F a cinq tranches (relevé Godot & Fils du 19/11/2026)', () => {
  const sheet = { productId: 'nap20', gold: 111.6, prices: [666.5, 665.5, 665, 664, 662.5] };
  const r = sheetResult(sheet);
  assert.equal(r.offs.length, 4);
  close(r.offs[0], 1 / (5.806 * 111.6), 1e-5);
  close(r.offs[3], 4 / (5.806 * 111.6), 1e-5);
  assert.equal(lotPriceOf(sheet, 9), 666.5);
  assert.equal(lotPriceOf(sheet, 10), 665.5);
  assert.equal(lotPriceOf(sheet, 49), 665.5);
  assert.equal(lotPriceOf(sheet, 99), 665);
  assert.equal(lotPriceOf(sheet, 499), 664);
  assert.equal(lotPriceOf(sheet, 500), 662.5);
  assert.throws(() => sheetResult({ ...sheet, prices: [666.5, 665.5, 665, 664] }), /cinq tranches/);
});

test('remise négociée par lot : 3 % (petits lots) à 5 % (gros lots) sur les prix publics de Godot & Fils', async () => {
  const { tierDiscount, negotiatedPrice, NEGOTIATED_DISCOUNT } = await import('../src/logic/godotCalc.ts');
  assert.deepEqual({ ...NEGOTIATED_DISCOUNT }, { min: 0.03, max: 0.05 });
  // Napoléon, 5 tranches : 3 %, 3,5 %, 4 %, 4,5 %, 5 %.
  assert.deepEqual(
    [0, 1, 2, 3, 4].map((i) => Math.round(tierDiscount(5, i) * 10000) / 10000),
    [0.03, 0.035, 0.04, 0.045, 0.05],
  );
  // Lingotins, 4 tranches : de 3 % à 5 %.
  close(tierDiscount(4, 0), 0.03, 1e-12);
  close(tierDiscount(4, 3), 0.05, 1e-12);
  // Prix publics du 20/11/2026 (Napoléon) → prix nets.
  const pub = [659, 658, 657.5, 656.5, 655];
  assert.deepEqual(
    pub.map((p, i) => negotiatedPrice(p, 5, i)),
    [639.23, 634.97, 631.2, 626.96, 622.25],
  );
  // Calculé comme prime : 5,00 % pour 1 à 9 pièces, d'après la valeur de l'or de la fiche.
  const r = sheetResult({
    productId: 'nap20',
    gold: 608.79 / 5.806,
    prices: pub.map((p, i) => negotiatedPrice(p, 5, i)),
  });
  close(r.premium, 0.05, 1e-4);
  close(r.offs[3], 0.0279, 1e-3);
});
