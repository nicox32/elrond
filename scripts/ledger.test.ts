// Tests de la logique du compte. Lancer : npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  accountValue,
  addBeneficiary,
  buy,
  convert,
  createAccount,
  isValidIban,
  LedgerError,
  migrateAccount,
  recordBalance,
  sell,
  SPREAD,
  transferToIban,
  transferToMember,
  TROY_OUNCE,
  unrealizedGain,
} from '../src/logic/ledger.ts';
import { fetchLivePrices, usdOunceToEurGram } from '../src/logic/prices.ts';

const prices = { gold: 100, silver: 1, platinum: 30 };
const close = (a: number, b: number, eps = 1e-4) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const VALID_IBAN = 'FR76 3000 6000 0112 3456 7890 189';

test('achat en euros, en grammes et en onces', () => {
  let acc = buy(createAccount('Test'), prices, 'gold', { unit: 'eur', value: 1000 });
  close(acc.holdings.gold, 1000 / (100 * (1 + SPREAD)));
  close(acc.transactions[0].eur, 1000, 0.01);

  acc = buy(createAccount('Test'), prices, 'silver', { unit: 'g', value: 50 });
  close(acc.holdings.silver, 50);
  close(acc.transactions[0].eur, 50 * (1 + SPREAD), 0.01);

  acc = buy(createAccount('Test'), prices, 'platinum', { unit: 'oz', value: 1 });
  close(acc.holdings.platinum, TROY_OUNCE);
});

test('acheter puis tout revendre coûte exactement l’écart', () => {
  let acc = buy(createAccount('Test'), prices, 'gold', { unit: 'eur', value: 1000 });
  const value = accountValue(acc, prices).total;
  close(value, (1000 * (1 - SPREAD)) / (1 + SPREAD), 1e-3);
  acc = sell(acc, prices, 'gold', { unit: 'eur', value });
  close(acc.holdings.gold, 0);
});

test('vente supérieure au solde refusée', () => {
  const acc = buy(createAccount('Test'), prices, 'gold', { unit: 'g', value: 1 });
  assert.throws(() => sell(acc, prices, 'gold', { unit: 'g', value: 2 }), LedgerError);
  assert.throws(() => sell(acc, prices, 'silver', { unit: 'g', value: 1 }), LedgerError);
});

test('montants invalides refusés', () => {
  const acc = createAccount('Test');
  for (const value of [0, -5, Number.NaN]) {
    assert.throws(() => buy(acc, prices, 'gold', { unit: 'eur', value }), LedgerError);
  }
});

test('conversion or → platine', () => {
  let acc = buy(createAccount('Test'), prices, 'gold', { unit: 'g', value: 10 });
  acc = convert(acc, prices, 'gold', 'platinum', { unit: 'g', value: 3 });
  close(acc.holdings.gold, 7);
  close(acc.holdings.platinum, (300 * (1 - SPREAD)) / (30 * (1 + SPREAD)));
  assert.throws(() => convert(acc, prices, 'gold', 'gold', { unit: 'g', value: 1 }), LedgerError);
});

test('virement à un membre : gratuit, en grammes', () => {
  let acc = buy(createAccount('Test'), prices, 'silver', { unit: 'g', value: 100 });
  const { account, beneficiary } = addBeneficiary(acc, 'member', 'Alice', 'alice@example.com');
  acc = transferToMember(account, prices, 'silver', { unit: 'g', value: 40 }, beneficiary);
  close(acc.holdings.silver, 60);
  assert.equal(acc.transactions[0].label, 'Virement à Alice');
  assert.equal(acc.beneficiaries.length, 1);
});

test('virement SEPA : vend le métal, IBAN vérifié', () => {
  assert.ok(isValidIban(VALID_IBAN));
  assert.ok(!isValidIban('FR76 3000 6000 0112 3456 7890 188'));
  for (let i = 0; i < 20; i++) assert.ok(isValidIban(createAccount('X').iban));
  const start = buy(createAccount('Test'), prices, 'gold', { unit: 'g', value: 10 });
  assert.throws(() => addBeneficiary(start, 'iban', 'Bob', 'FR00 1234'), LedgerError);
  const { account, beneficiary } = addBeneficiary(start, 'iban', 'Bob', VALID_IBAN.replace(/ /g, ''));
  assert.equal(beneficiary.identifier, VALID_IBAN);
  const acc = transferToIban(account, prices, 'gold', { unit: 'eur', value: 199 }, beneficiary);
  close(acc.holdings.gold, 10 - 199 / (100 * (1 - SPREAD)));
});

test('historique du solde : un point par minute au plus', () => {
  let acc = buy(createAccount('Test'), prices, 'gold', { unit: 'g', value: 1 });
  const t0 = new Date('2026-01-01T10:00:00Z');
  acc = recordBalance(acc, prices, t0);
  acc = recordBalance(acc, prices, new Date(t0.getTime() + 10_000));
  assert.equal(acc.balanceHistory.length, 1);
  acc = recordBalance(acc, prices, new Date(t0.getTime() + 120_000));
  assert.equal(acc.balanceHistory.length, 2);
  close(acc.balanceHistory[1].total, 100 * (1 - SPREAD), 0.01);
});

test('migration d’un compte de la première version', () => {
  const v1 = {
    holder: 'Nico',
    iban: 'FR76 1111',
    goldGrams: 2,
    silverGrams: 50,
    goldAllocation: 70,
    transactions: [{ id: 'a', kind: 'deposit', date: '2026-01-01', goldDelta: 2, silverDelta: 50, eur: 260, label: 'Dépôt' }],
  };
  const acc = migrateAccount(v1);
  assert.ok(acc);
  assert.equal(acc.version, 2);
  assert.deepEqual(acc.holdings, { gold: 2, silver: 50, platinum: 0 });
  assert.equal(acc.transactions[0].kind, 'buy');
  assert.equal(acc.iban, 'FR76 1111');
  assert.equal(migrateAccount(null), null);
});

test('cours réels : conversion USD/once → EUR/gramme', async () => {
  close(usdOunceToEurGram(TROY_OUNCE, 0.5), 0.5);
  const fakeFetch = (async (url: string) => {
    const body = url.includes('XAU')
      ? { price: 3110.34768 }
      : url.includes('XAG')
        ? { price: 31.1034768 }
        : url.includes('XPT')
          ? { price: 1000 }
          : { rates: { EUR: 0.9 } };
    return { ok: true, status: 200, json: async () => body };
  }) as unknown as typeof fetch;
  const quote = await fetchLivePrices(fakeFetch);
  assert.equal(quote.source, 'live');
  close(quote.prices.gold, 90);
  close(quote.prices.silver, 0.9);
});

test('cours réels : échec réseau signalé', async () => {
  const failing = (async () => ({ ok: false, status: 503, json: async () => ({}) })) as unknown as typeof fetch;
  await assert.rejects(fetchLivePrices(failing));
});

test('plus-value : valeur actuelle moins euros nets placés', () => {
  let acc = buy(createAccount('Test'), prices, 'gold', { unit: 'eur', value: 1000 });
  acc = sell(acc, prices, 'gold', { unit: 'eur', value: 200 });
  const higher = { ...prices, gold: 110 };
  const r = unrealizedGain(acc, higher);
  close(r.invested, 800, 0.01);
  close(r.gain, acc.holdings.gold * 110 * (1 - SPREAD) - 800, 0.01);
});

test('relevés de cours : 24 h gardées, relevés rapprochés fusionnés, cours non réels ignorés', async () => {
  const { addPricePoint, metalTrend, PRICE_HISTORY_MS } = await import('../src/logic/priceHistory.ts');
  const q = (iso: string, gold: number, source: 'live' | 'cache' = 'live') => ({
    prices: { gold, silver: 1, platinum: 30 },
    fetchedAt: iso,
    source,
  });
  const t0 = Date.parse('2026-11-02T10:00:00Z');
  const at = (ms: number) => new Date(t0 + ms).toISOString();
  let h = addPricePoint([], q(at(0), 100));
  h = addPricePoint(h, q(at(10_000), 101)); // fusionné avec le précédent
  assert.equal(h.length, 1);
  assert.equal(h[0].prices.gold, 101);
  h = addPricePoint(h, q(at(30_000), 102));
  h = addPricePoint(h, q(at(60_000), 999, 'cache')); // ignoré
  assert.equal(h.length, 2);
  h = addPricePoint(h, q(at(PRICE_HISTORY_MS + 20_000), 110)); // le premier relevé sort des 24 h
  assert.deepEqual(h.map((p) => p.prices.gold), [102, 110]);
  const trend = metalTrend(h, 'gold', { gold: 110, silver: 1, platinum: 30 });
  assert.deepEqual(trend.values, [102, 110]);
  close(trend.changePct, (8 / 102) * 100);
});

test('cours réels : taux de change gardé 10 minutes', async () => {
  const { clearFxCache } = await import('../src/logic/prices.ts');
  clearFxCache();
  let fxCalls = 0;
  const fetchFn = (async (url: string) => {
    if (!url.includes('gold-api')) fxCalls++;
    return { ok: true, status: 200, json: async () => (url.includes('gold-api') ? { price: 100 } : { rates: { EUR: 0.9 } }) };
  }) as unknown as typeof fetch;
  const t = Date.parse('2026-11-02T10:00:00Z');
  await fetchLivePrices(fetchFn, new Date(t));
  await fetchLivePrices(fetchFn, new Date(t + 5 * 60_000));
  assert.equal(fxCalls, 1);
  await fetchLivePrices(fetchFn, new Date(t + 11 * 60_000));
  assert.equal(fxCalls, 2);
});
