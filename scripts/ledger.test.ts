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
  transferToIban,
  transferToMember,
  TROY_OUNCE,
  unrealizedGain,
} from '../src/logic/ledger.ts';
import { FEES } from '../src/logic/fees.ts';
import { fetchLivePrices, usdOunceToEurGram } from '../src/logic/prices.ts';

const prices = { gold: 100, silver: 1, platinum: 30 };
const close = (a: number, b: number, eps = 1e-4) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const VALID_IBAN = 'FR76 3000 6000 0112 3456 7890 189';

test('achat en euros, en grammes et en onces : frais en part du montant payé', () => {
  let acc = buy(createAccount('Test'), prices, 'gold', { unit: 'eur', value: 1000 });
  close(acc.holdings.gold, (1000 * (1 - FEES.buy.gold)) / 100); // 2,8 % → 9,72 g
  close(acc.transactions[0].eur, 1000, 0.01);
  close(acc.transactions[0].fees ?? 0, 28, 0.01);

  acc = buy(createAccount('Test'), prices, 'silver', { unit: 'g', value: 50 });
  close(acc.holdings.silver, 50);
  close(acc.transactions[0].eur, 50 / (1 - FEES.buy.silver), 0.01); // 6,8 %

  acc = buy(createAccount('Test'), prices, 'platinum', { unit: 'oz', value: 1 });
  close(acc.holdings.platinum, TROY_OUNCE);
});

test('revente : 0,8 % en différé, 0,8 % + 2,8 % en immédiat', () => {
  const start = buy(createAccount('Test'), prices, 'gold', { unit: 'g', value: 10 });
  let acc = sell(start, prices, 'gold', { unit: 'g', value: 1 }, 'deferred');
  close(acc.transactions[0].eur, 100 * (1 - 0.008), 0.01);
  close(acc.transactions[0].fees ?? 0, 0.8, 0.01);
  acc = sell(start, prices, 'gold', { unit: 'g', value: 1 }, 'immediate');
  close(acc.transactions[0].eur, 100 * (1 - 0.008 - 0.028), 0.01);
  // saisie en euros = montant reçu
  acc = sell(start, prices, 'gold', { unit: 'eur', value: 99.2 }, 'deferred');
  close(acc.holdings.gold, 9);
  // tout revendre
  const value = accountValue(start, prices).total;
  acc = sell(start, prices, 'gold', { unit: 'eur', value }, 'deferred');
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

test('conversion or → platine : 0,8 % + frais d’achat du métal reçu', () => {
  let acc = buy(createAccount('Test'), prices, 'gold', { unit: 'g', value: 10 });
  acc = convert(acc, prices, 'gold', 'platinum', { unit: 'g', value: 3 });
  close(acc.holdings.gold, 7);
  // 0,8 % de frais de conversion puis 6,8 % de frais d'achat du platine
  close(acc.holdings.platinum, (300 * (1 - 0.008) * (1 - 0.068)) / 30);
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

test('virement SEPA : vend le métal, IBAN vérifié, frais fixe vers l’étranger', () => {
  assert.ok(isValidIban(VALID_IBAN));
  assert.ok(!isValidIban('FR76 3000 6000 0112 3456 7890 188'));
  for (let i = 0; i < 20; i++) assert.ok(isValidIban(createAccount('X').iban));
  const start = buy(createAccount('Test'), prices, 'gold', { unit: 'g', value: 10 });
  assert.throws(() => addBeneficiary(start, 'iban', 'Bob', 'FR00 1234'), LedgerError);
  const { account, beneficiary } = addBeneficiary(start, 'iban', 'Bob', VALID_IBAN.replace(/ /g, ''));
  assert.equal(beneficiary.identifier, VALID_IBAN);
  // France, différé : Bob reçoit 198,40 € pour 2 g
  let acc = transferToIban(account, prices, 'gold', { unit: 'g', value: 2 }, beneficiary, 'deferred');
  close(acc.transactions[0].eur, 198.4, 0.01);
  // Étranger (Belgique), immédiat : saisie en euros = montant reçu, + 30 € de frais fixe
  const be = addBeneficiary(account, 'iban', 'Zoé', 'BE68539007547034');
  acc = transferToIban(be.account, prices, 'gold', { unit: 'eur', value: 100 }, be.beneficiary, 'immediate');
  close(acc.holdings.gold, 10 - 130 / (100 * (1 - 0.036)));
  close(acc.transactions[0].eur, 100, 0.01);
  // trop faible pour couvrir les 30 €
  assert.throws(
    () => transferToIban(be.account, prices, 'gold', { unit: 'g', value: 0.1 }, be.beneficiary, 'deferred'),
    LedgerError,
  );
});

test('historique du solde : un point par minute au plus', () => {
  let acc = buy(createAccount('Test'), prices, 'gold', { unit: 'g', value: 1 });
  const t0 = new Date('2026-01-01T10:00:00Z');
  acc = recordBalance(acc, prices, t0);
  acc = recordBalance(acc, prices, new Date(t0.getTime() + 10_000));
  assert.equal(acc.balanceHistory.length, 1);
  acc = recordBalance(acc, prices, new Date(t0.getTime() + 120_000));
  assert.equal(acc.balanceHistory.length, 2);
  close(acc.balanceHistory[1].total, 100 * (1 - FEES.sale), 0.01);
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
  close(r.invested, 1000 - acc.transactions[0].eur, 0.01);
  close(r.gain, acc.holdings.gold * 110 * (1 - FEES.sale) - (1000 - acc.transactions[0].eur), 0.01);
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

test('comptes enfants : gratuits, alimentés et repris depuis le compte principal', async () => {
  const { addChild, fundChild, withdrawFromChild, removeChild } = await import('../src/logic/ledger.ts');
  let acc = buy(createAccount('Parent'), prices, 'gold', { unit: 'g', value: 10 });
  const r = addChild(acc, 'Léo');
  acc = r.account;
  assert.throws(() => addChild(acc, '  '), LedgerError);
  acc = fundChild(acc, prices, r.child.id, 'gold', { unit: 'g', value: 4 });
  close(acc.holdings.gold, 6);
  close(acc.children[0].holdings.gold, 4);
  assert.equal(acc.children[0].transactions[0].kind, 'family_in');
  assert.equal(acc.children[0].transactions[0].fees, undefined); // gratuit
  assert.throws(() => fundChild(acc, prices, r.child.id, 'gold', { unit: 'g', value: 100 }), LedgerError);
  assert.throws(() => removeChild(acc, r.child.id), LedgerError); // pas vide
  acc = withdrawFromChild(acc, prices, r.child.id, 'gold', { unit: 'g', value: 4 });
  close(acc.holdings.gold, 10);
  acc = removeChild(acc, r.child.id);
  assert.equal(acc.children.length, 0);
});

test('frais d’oxydation : 0,02 %/jour facturés pour chaque période de 6 mois sans opération d’au moins 1 €', async () => {
  const { applyDormancy, dormancyStatus, addChild, fundChild } = await import('../src/logic/ledger.ts');
  const t0 = new Date('2026-01-10T12:00:00Z');
  const day = 86_400_000;
  let acc = buy(createAccount('Test', t0), prices, 'gold', { unit: 'g', value: 100 }, t0);
  const r = addChild(acc, 'Léa', '2008-01-01', t0); // majeure depuis le 1er janvier 2026
  acc = fundChild(r.account, prices, r.child.id, 'gold', { unit: 'g', value: 50 }, t0);
  // 5 mois plus tard : rien
  const m5 = new Date('2026-06-10T12:00:00Z');
  assert.equal(applyDormancy(acc, prices, m5), acc);
  assert.ok(!dormancyStatus(acc, m5).inactive);
  // Une opération de moins de 1 € ne compte pas comme un mouvement
  const tiny = buy(acc, prices, 'gold', { unit: 'eur', value: 0.5 }, m5);
  assert.equal(dormancyStatus(tiny, m5).lastMovement.toISOString(), t0.toISOString());
  // 6 mois écoulés (10 janvier → 10 juillet = 181 jours) : facturés d'un coup, sur chaque compte
  const m6 = new Date('2026-07-12T12:00:00Z');
  const charged = applyDormancy(acc, prices, m6);
  const share = 0.0002 * 181;
  close(charged.holdings.gold, 50 * (1 - share));
  close(charged.children[0].holdings.gold, 50 * (1 - share));
  assert.equal(charged.transactions[0].kind, 'fee_dormancy');
  // relancé plus tard dans la même période : pas de double facturation
  assert.equal(applyDormancy(charged, prices, new Date(m6.getTime() + 60 * day)), charged);
  // 6 mois de plus sans opération (10 juillet → 10 janvier = 184 jours) : la période suivante est facturée
  const m12 = new Date('2027-01-11T12:00:00Z');
  const again = applyDormancy(charged, prices, m12);
  close(again.holdings.gold, 50 * (1 - share) * (1 - 0.0002 * 184));
  // une opération d'au moins 1 € remet le compteur à zéro
  const moved = buy(again, prices, 'gold', { unit: 'eur', value: 1 }, m12);
  assert.ok(!dormancyStatus(moved, new Date(m12.getTime() + 30 * day)).inactive);
});

test('compte enfant : aucun frais d’oxydation avant 18 ans, compteur lancé à la majorité', async () => {
  const { addChild, applyDormancy, dormancyStatus, fundChild, parseBirthDate, setChildBirthDate } = await import(
    '../src/logic/ledger.ts'
  );
  const now = new Date('2026-11-02T12:00:00Z');
  assert.equal(parseBirthDate('05/03/2015', now), '2015-03-05');
  assert.throws(() => parseBirthDate('31/02/2015', now), LedgerError); // n'existe pas
  assert.throws(() => parseBirthDate('01/01/2030', now), LedgerError); // futur
  assert.throws(() => parseBirthDate('01/01/2000', now), LedgerError); // déjà majeur
  assert.throws(() => parseBirthDate('2015-03-05', now), LedgerError); // mauvais format

  const t0 = new Date('2026-01-10T12:00:00Z');
  let acc = buy(createAccount('Parent', t0), prices, 'gold', { unit: 'g', value: 100 }, t0);
  // Enfant né le 1er juin 2010 : majeur le 1er juin 2028
  const r = addChild(acc, 'Tom', '2010-06-01', t0);
  acc = fundChild(r.account, prices, r.child.id, 'gold', { unit: 'g', value: 10 }, t0);
  // 2 ans sans opération, toujours mineur : rien sur son compte (le parent, lui, paie)
  const y2 = new Date('2028-01-10T12:00:00Z');
  const charged = applyDormancy(acc, prices, y2);
  close(charged.children[0].holdings.gold, 10);
  assert.ok(charged.holdings.gold < 90);
  assert.ok(dormancyStatus(charged.children[0], y2).exempt);
  // Majeur le 1er juin 2028 : les 6 mois courent à partir de là → rien avant le 1er décembre 2028
  assert.equal(applyDormancy(charged, prices, new Date('2028-11-30T12:00:00Z')).children[0], charged.children[0]);
  const after = applyDormancy(charged, prices, new Date('2028-12-02T12:00:00Z'));
  close(after.children[0].holdings.gold, 10 * (1 - 0.0002 * 183));
  // Sans date de naissance connue : exonéré
  const noDate = addChild(acc, 'Ana', undefined, t0);
  const later = applyDormancy(fundChild(noDate.account, prices, noDate.child.id, 'gold', { unit: 'g', value: 5 }, t0), prices, y2);
  close(later.children.find((c) => c.name === 'Ana')!.holdings.gold, 5);
  // Date ajoutée ensuite
  const dated = setChildBirthDate(later, noDate.child.id, '2012-01-01');
  assert.equal(dated.children.find((c) => c.name === 'Ana')!.birthDate, '2012-01-01');
});

test('opérations qui évitent les frais : achat et échanges de louis, pas les ventes ni les virements IBAN', async () => {
  const { dormancyStatus } = await import('../src/logic/ledger.ts');
  const { toLouis } = await import('../src/logic/currency.ts');
  const t0 = new Date('2026-01-10T12:00:00Z');
  const acc = buy(createAccount('Test', t0), prices, 'gold', { unit: 'g', value: 10 }, t0);
  const later = new Date('2026-05-01T12:00:00Z');
  const sold = sell(acc, prices, 'gold', { unit: 'g', value: 1 }, 'deferred', later);
  assert.equal(dormancyStatus(sold, later).lastMovement.toISOString(), t0.toISOString()); // la vente ne compte pas
  const converted = convert(acc, prices, 'gold', 'silver', { unit: 'g', value: 1 }, later);
  assert.equal(dormancyStatus(converted, later).lastMovement.toISOString(), later.toISOString()); // échange : compte
  // 1 louis = la valeur d'un gramme d'or
  close(toLouis(250, prices), 2.5);
});
